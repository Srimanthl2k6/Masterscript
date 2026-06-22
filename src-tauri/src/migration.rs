use crate::file_grants::FileGrantRegistry;
use crate::import_security::{
    read_manifest_file, read_project_file, validate_project_value, validate_trusted_legacy_autosave,
};
use crate::legacy::{self, InstallKind, InstallState};
use crate::persistence::{read_json, write_json_atomic};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use tauri::Manager;

const INSTALL_STATE_FILE: &str = "install-state-v1.json";
const MIGRATION_MANIFEST_FILE: &str = "migration-manifest-v1.json";
const IMPORTED_MANIFEST_FILE: &str = "imported-migration-manifest-v1.json";
const AUTOSAVE_FILE: &str = "autosave.msproj.json";
const RECENT_PROJECT_SNAPSHOTS_FILE: &str = "recent-project-snapshots-v1.json";
const MIGRATION_REPORT_FILE: &str = "migration-report-v1.json";
const RECENT_PROJECT_LIMIT: usize = 100;
const RECENT_SNAPSHOT_LIMIT: usize = 12;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationManifestV1 {
    pub schema_version: u8,
    pub source_version: String,
    pub exported_at: String,
    pub legacy_install: bool,
    pub tutorial_completed: bool,
    pub theme: String,
    pub recent_projects: Value,
    pub recent_project_snapshots: Value,
    pub hosted_lan_rooms: Vec<String>,
    pub autosave_path: Option<String>,
}

impl MigrationManifestV1 {
    fn is_valid(&self) -> bool {
        self.schema_version == 1
            && self.legacy_install
            && self.tutorial_completed
            && matches!(self.theme.as_str(), "dark" | "light")
            && self.source_version.len() <= 64
            && self.exported_at.len() <= 64
            && self
                .recent_projects
                .as_array()
                .is_some_and(|entries| entries.len() <= RECENT_PROJECT_LIMIT)
            && self
                .recent_project_snapshots
                .as_object()
                .is_some_and(|entries| entries.len() <= RECENT_SNAPSHOT_LIMIT)
            && self.hosted_lan_rooms.len() <= RECENT_PROJECT_LIMIT
            && match self.autosave_path.as_ref() {
                Some(path) => path.len() <= 4096,
                None => true,
            }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MigrationReportV1 {
    schema_version: u8,
    autosave: String,
    recent_project_snapshots: String,
    notes: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapInstallationResult {
    pub install_state: InstallState,
    pub migration_manifest: Option<MigrationManifestV1>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PersistedInstallState {
    tutorial_completed: bool,
    migration_version: Option<u8>,
    #[serde(default)]
    legacy_migrated: bool,
}

fn app_data_dir(app: &tauri::AppHandle) -> io::Result<PathBuf> {
    app.path().app_data_dir().map_err(io::Error::other)
}

fn read_valid_manifest(path: &Path) -> Option<MigrationManifestV1> {
    let mut manifest = read_manifest_file::<MigrationManifestV1>(path).ok()?;
    if !manifest.is_valid() {
        return None;
    }
    let _ = sanitize_manifest(&mut manifest);
    Some(manifest)
}

fn sanitize_manifest(manifest: &mut MigrationManifestV1) -> Vec<String> {
    let mut notes = Vec::new();
    if let Some(entries) = manifest.recent_projects.as_array_mut() {
        let original_len = entries.len();
        entries.retain(|entry| {
            let Some(entry) = entry.as_object() else {
                return false;
            };
            entry
                .get("label")
                .and_then(Value::as_str)
                .is_some_and(|value| !value.trim().is_empty())
                && matches!(
                    entry.get("source").and_then(Value::as_str),
                    Some("project" | "import")
                )
                && entry
                    .get("updatedAt")
                    .and_then(Value::as_str)
                    .is_some_and(|value| !value.trim().is_empty())
                && match entry.get("projectId") {
                    Some(value) => value.is_string(),
                    None => true,
                }
                && match entry.get("fileGrantId") {
                    Some(value) => value.is_string(),
                    None => true,
                }
        });
        entries.truncate(RECENT_PROJECT_LIMIT);
        if entries.len() < original_len {
            notes.push("Skipped malformed recent-project entries".into());
        }
    }
    if let Some(snapshots) = manifest.recent_project_snapshots.as_object_mut() {
        let original_len = snapshots.len();
        snapshots.retain(|_, project| validate_project_value(project).is_ok());
        let retained = std::mem::take(snapshots)
            .into_iter()
            .take(RECENT_SNAPSHOT_LIMIT)
            .collect();
        *snapshots = retained;
        if snapshots.len() < original_len {
            notes.push("Skipped malformed or excess recent-project snapshots".into());
        }
    }
    let original_room_count = manifest.hosted_lan_rooms.len();
    let mut seen = HashSet::new();
    manifest
        .hosted_lan_rooms
        .retain(|room| !room.trim().is_empty() && room.len() <= 256 && seen.insert(room.clone()));
    manifest.hosted_lan_rooms.truncate(RECENT_PROJECT_LIMIT);
    if manifest.hosted_lan_rooms.len() < original_room_count {
        notes.push("Skipped malformed or duplicate hosted LAN rooms".into());
    }
    notes
}

fn find_legacy_manifest(candidates: &[PathBuf]) -> Option<(PathBuf, MigrationManifestV1)> {
    candidates.iter().find_map(|directory| {
        let path = directory.join(MIGRATION_MANIFEST_FILE);
        read_manifest_file::<MigrationManifestV1>(&path)
            .ok()
            .filter(MigrationManifestV1::is_valid)
            .map(|manifest| (directory.clone(), manifest))
    })
}

fn migrate_legacy_payloads(
    app_directory: &Path,
    legacy_directory: &Path,
    manifest: Option<&MigrationManifestV1>,
) -> io::Result<MigrationReportV1> {
    let mut report = MigrationReportV1 {
        schema_version: 1,
        autosave: "not-found".into(),
        recent_project_snapshots: "not-found".into(),
        notes: Vec::new(),
    };
    let autosave_target = app_directory.join(AUTOSAVE_FILE);
    let manifest_path = manifest
        .and_then(|value| value.autosave_path.as_deref())
        .map(PathBuf::from);
    let fallback_path = legacy_directory.join(AUTOSAVE_FILE);
    let source = if let Some(path) = manifest_path {
        match validate_trusted_legacy_autosave(legacy_directory, &path) {
            Ok(path) => Some(path),
            Err(error) => {
                report
                    .notes
                    .push(format!("Skipped untrusted manifest autosave path: {error}"));
                validate_trusted_legacy_autosave(legacy_directory, &fallback_path).ok()
            }
        }
    } else {
        validate_trusted_legacy_autosave(legacy_directory, &fallback_path).ok()
    };

    if autosave_target.exists() {
        report.autosave = "preserved-existing".into();
    } else if let Some(source) = source {
        match read_project_file(&source) {
            Ok(project) => {
                write_json_atomic(&autosave_target, &project)?;
                report.autosave = "imported".into();
            }
            Err(error) => {
                report.autosave = "skipped-invalid".into();
                report
                    .notes
                    .push(format!("Skipped invalid legacy autosave: {error}"));
            }
        }
    }

    let snapshots_target = app_directory.join(RECENT_PROJECT_SNAPSHOTS_FILE);
    if snapshots_target.exists() {
        report.recent_project_snapshots = "preserved-existing".into();
    } else if let Some(snapshots) =
        manifest.and_then(|value| value.recent_project_snapshots.as_object())
    {
        let mut valid = serde_json::Map::new();
        for (project_id, project) in snapshots {
            if validate_project_value(project).is_ok() {
                valid.insert(project_id.clone(), project.clone());
            } else {
                report
                    .notes
                    .push(format!("Skipped invalid recent snapshot {project_id}"));
            }
        }
        if valid.is_empty() {
            report.recent_project_snapshots = "skipped-invalid".into();
        } else {
            write_json_atomic(&snapshots_target, &Value::Object(valid))?;
            report.recent_project_snapshots = "imported".into();
        }
    }
    Ok(report)
}

fn existing_installation(
    app_directory: &Path,
    install_state_path: &Path,
    imported_manifest_path: &Path,
) -> Option<BootstrapInstallationResult> {
    let persisted = read_json::<PersistedInstallState>(install_state_path).ok()?;
    let mut manifest = read_valid_manifest(imported_manifest_path);
    if let Some(value) = manifest.as_mut() {
        if let Ok(mut grants) = FileGrantRegistry::load_in_directory(app_directory) {
            if grants
                .migrate_recent_projects(&mut value.recent_projects)
                .is_ok()
            {
                let _ = write_json_atomic(imported_manifest_path, value);
            }
        }
    }
    Some(BootstrapInstallationResult {
        install_state: InstallState {
            kind: InstallKind::ExistingTauri,
            tutorial_completed: persisted.tutorial_completed,
            migration_version: persisted.migration_version,
        },
        migration_manifest: manifest,
    })
}

fn recover_existing_tauri_installation(
    app_directory: &Path,
    install_state_path: &Path,
    imported_manifest_path: &Path,
) -> io::Result<Option<BootstrapInstallationResult>> {
    let evidence_files = [
        AUTOSAVE_FILE,
        RECENT_PROJECT_SNAPSHOTS_FILE,
        IMPORTED_MANIFEST_FILE,
        MIGRATION_REPORT_FILE,
        "file-grants-v1.json",
    ];
    if !evidence_files
        .iter()
        .any(|name| app_directory.join(name).is_file())
    {
        return Ok(None);
    }

    let manifest = read_valid_manifest(imported_manifest_path);
    let migration_version = manifest.as_ref().map(|_| 1);
    let persisted = PersistedInstallState {
        tutorial_completed: true,
        migration_version,
        legacy_migrated: migration_version.is_some(),
    };
    write_json_atomic(install_state_path, &persisted)?;
    Ok(Some(BootstrapInstallationResult {
        install_state: InstallState {
            kind: InstallKind::ExistingTauri,
            tutorial_completed: true,
            migration_version,
        },
        migration_manifest: manifest,
    }))
}

pub fn bootstrap(app: &tauri::AppHandle) -> io::Result<BootstrapInstallationResult> {
    let app_directory = app_data_dir(app)?;
    fs::create_dir_all(&app_directory)?;
    let install_state_path = app_directory.join(INSTALL_STATE_FILE);
    let imported_manifest_path = app_directory.join(IMPORTED_MANIFEST_FILE);

    if let Some(existing) =
        existing_installation(&app_directory, &install_state_path, &imported_manifest_path)
    {
        return Ok(existing);
    }
    if let Some(existing) = recover_existing_tauri_installation(
        &app_directory,
        &install_state_path,
        &imported_manifest_path,
    )? {
        return Ok(existing);
    }

    let candidates = legacy::current_platform_candidates()
        .into_iter()
        .map(PathBuf::from)
        .filter(|path| path != &app_directory)
        .collect::<Vec<_>>();
    let legacy_directory = candidates.iter().find(|path| path.is_dir()).cloned();
    let manifest_match = find_legacy_manifest(&candidates);
    let invalid_manifest_present = manifest_match.is_none()
        && candidates
            .iter()
            .any(|directory| directory.join(MIGRATION_MANIFEST_FILE).exists());
    let mut manifest = manifest_match.as_ref().map(|(_, value)| value.clone());
    let manifest_directory = manifest_match.as_ref().map(|(path, _)| path.as_path());
    let evidence_directory = manifest_directory.or(legacy_directory.as_deref());
    let legacy_evidence_exists = evidence_directory.is_some();

    if legacy_evidence_exists {
        let mut report = evidence_directory
            .map(|directory| migrate_legacy_payloads(&app_directory, directory, manifest.as_ref()))
            .transpose()?;
        if let Some(value) = manifest.as_mut() {
            let sanitization_notes = sanitize_manifest(value);
            if let Some(report) = report.as_mut() {
                report.notes.extend(sanitization_notes);
            }
            if let Ok(mut grants) = FileGrantRegistry::load_in_directory(&app_directory) {
                grants.migrate_recent_projects(&mut value.recent_projects)?;
            }
            write_json_atomic(&imported_manifest_path, value)?;
        }
        if let Some(report) = report.as_mut() {
            if invalid_manifest_present {
                report
                    .notes
                    .push("Skipped invalid or unsupported migration manifest".into());
            }
            write_json_atomic(&app_directory.join(MIGRATION_REPORT_FILE), &report)?;
        }
    }

    let install_state = legacy::classify(legacy_evidence_exists, false, None);
    write_json_atomic(
        &install_state_path,
        &PersistedInstallState {
            tutorial_completed: install_state.tutorial_completed,
            migration_version: install_state.migration_version,
            legacy_migrated: legacy_evidence_exists,
        },
    )?;

    Ok(BootstrapInstallationResult {
        install_state,
        migration_manifest: manifest,
    })
}

pub fn get_install_state(app: &tauri::AppHandle) -> io::Result<InstallState> {
    Ok(bootstrap(app)?.install_state)
}

pub fn set_tutorial_completed(app: &tauri::AppHandle, completed: bool) -> io::Result<()> {
    let app_directory = app_data_dir(app)?;
    fs::create_dir_all(&app_directory)?;
    let path = app_directory.join(INSTALL_STATE_FILE);
    let current = read_json::<PersistedInstallState>(&path).unwrap_or(PersistedInstallState {
        tutorial_completed: false,
        migration_version: None,
        legacy_migrated: false,
    });
    write_json_atomic(
        &path,
        &PersistedInstallState {
            tutorial_completed: completed,
            ..current
        },
    )
}

#[cfg(test)]
mod tests {
    use super::{
        migrate_legacy_payloads, read_valid_manifest, recover_existing_tauri_installation,
        MigrationManifestV1,
    };
    use crate::import_security::MIGRATION_MANIFEST_LIMIT;
    use serde_json::json;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn rejects_incomplete_or_wrong_version_manifests() {
        let valid = MigrationManifestV1 {
            schema_version: 1,
            source_version: "0.1.14".into(),
            exported_at: "2026-06-21T13:00:00.000Z".into(),
            legacy_install: true,
            tutorial_completed: true,
            theme: "dark".into(),
            recent_projects: json!([]),
            recent_project_snapshots: json!({}),
            hosted_lan_rooms: Vec::new(),
            autosave_path: None,
        };
        assert!(valid.is_valid());

        let invalid = MigrationManifestV1 {
            schema_version: 2,
            ..valid
        };
        assert!(!invalid.is_valid());
    }

    #[test]
    fn rejects_oversized_migration_manifests_before_deserialization() {
        let directory = tempdir().expect("directory");
        let path = directory.path().join("migration-manifest-v1.json");
        fs::write(&path, vec![b' '; MIGRATION_MANIFEST_LIMIT + 1]).expect("oversized manifest");

        assert!(read_valid_manifest(&path).is_none());
    }

    #[test]
    fn preserves_existing_state_and_reports_untrusted_legacy_paths() {
        let app = tempdir().expect("app directory");
        let legacy = tempdir().expect("legacy directory");
        let outside = tempdir().expect("outside directory");
        let target = app.path().join("autosave.msproj.json");
        fs::write(&target, r#"{"existing":true}"#).expect("existing autosave");
        let outside_autosave = outside.path().join("autosave.msproj.json");
        fs::write(&outside_autosave, r#"{"schemaVersion":1}"#).expect("outside autosave");

        let manifest = MigrationManifestV1 {
            schema_version: 1,
            source_version: "0.2.1".into(),
            exported_at: "2026-06-22T00:00:00.000Z".into(),
            legacy_install: true,
            tutorial_completed: true,
            theme: "dark".into(),
            recent_projects: json!([]),
            recent_project_snapshots: json!({}),
            hosted_lan_rooms: Vec::new(),
            autosave_path: Some(outside_autosave.to_string_lossy().into_owned()),
        };

        let report =
            migrate_legacy_payloads(app.path(), legacy.path(), Some(&manifest)).expect("migration");

        assert_eq!(report.autosave, "preserved-existing");
        assert!(report
            .notes
            .iter()
            .any(|note| note.contains("outside") || note.contains("untrusted")));
        assert_eq!(
            fs::read_to_string(target).expect("preserved autosave"),
            r#"{"existing":true}"#
        );
    }

    #[test]
    fn existing_tauri_evidence_suppresses_tutorial_after_state_corruption() {
        let app = tempdir().expect("app directory");
        let install_state = app.path().join("install-state-v1.json");
        let imported_manifest = app.path().join("imported-migration-manifest-v1.json");
        fs::write(
            app.path().join("autosave.msproj.json"),
            b"corrupt but existing",
        )
        .expect("existing app evidence");

        let recovered =
            recover_existing_tauri_installation(app.path(), &install_state, &imported_manifest)
                .expect("recover state")
                .expect("existing installation");

        assert!(recovered.install_state.tutorial_completed);
        assert!(install_state.is_file());
    }
}
