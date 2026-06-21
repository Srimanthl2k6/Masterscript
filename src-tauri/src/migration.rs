use crate::legacy::{self, InstallKind, InstallState};
use crate::persistence::{read_json, read_json_value, write_json_atomic};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use tauri::Manager;

const INSTALL_STATE_FILE: &str = "install-state-v1.json";
const MIGRATION_MANIFEST_FILE: &str = "migration-manifest-v1.json";
const IMPORTED_MANIFEST_FILE: &str = "imported-migration-manifest-v1.json";
const AUTOSAVE_FILE: &str = "autosave.msproj.json";
const RECENT_PROJECT_SNAPSHOTS_FILE: &str = "recent-project-snapshots-v1.json";

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
            && self.recent_projects.is_array()
            && self.recent_project_snapshots.is_object()
    }
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
    read_json::<MigrationManifestV1>(path)
        .ok()
        .filter(MigrationManifestV1::is_valid)
}

fn find_legacy_manifest(candidates: &[PathBuf]) -> Option<(PathBuf, MigrationManifestV1)> {
    candidates.iter().find_map(|directory| {
        let path = directory.join(MIGRATION_MANIFEST_FILE);
        read_valid_manifest(&path).map(|manifest| (directory.clone(), manifest))
    })
}

fn copy_valid_autosave_once(
    app_directory: &Path,
    legacy_directory: Option<&Path>,
    manifest: Option<&MigrationManifestV1>,
) {
    let target = app_directory.join(AUTOSAVE_FILE);
    if target.exists() {
        return;
    }

    let manifest_path = manifest
        .and_then(|value| value.autosave_path.as_deref())
        .map(PathBuf::from);
    let fallback_path = legacy_directory.map(|directory| directory.join(AUTOSAVE_FILE));
    let source = manifest_path
        .filter(|path| path.is_file())
        .or_else(|| fallback_path.filter(|path| path.is_file()));

    if let Some(project) = source
        .as_deref()
        .and_then(|path| read_json_value(path).ok())
    {
        let _ = write_json_atomic(&target, &project);
    }
}

fn import_recent_project_snapshots_once(
    app_directory: &Path,
    manifest: Option<&MigrationManifestV1>,
) {
    let target = app_directory.join(RECENT_PROJECT_SNAPSHOTS_FILE);
    if target.exists() {
        return;
    }
    if let Some(snapshots) = manifest.map(|value| &value.recent_project_snapshots) {
        let _ = write_json_atomic(&target, snapshots);
    }
}

fn existing_installation(
    install_state_path: &Path,
    imported_manifest_path: &Path,
) -> Option<BootstrapInstallationResult> {
    let persisted = read_json::<PersistedInstallState>(install_state_path).ok()?;
    let manifest = read_valid_manifest(imported_manifest_path);
    Some(BootstrapInstallationResult {
        install_state: InstallState {
            kind: InstallKind::ExistingTauri,
            tutorial_completed: persisted.tutorial_completed,
            migration_version: persisted.migration_version,
        },
        migration_manifest: manifest,
    })
}

pub fn bootstrap(app: &tauri::AppHandle) -> io::Result<BootstrapInstallationResult> {
    let app_directory = app_data_dir(app)?;
    fs::create_dir_all(&app_directory)?;
    let install_state_path = app_directory.join(INSTALL_STATE_FILE);
    let imported_manifest_path = app_directory.join(IMPORTED_MANIFEST_FILE);

    if let Some(existing) = existing_installation(&install_state_path, &imported_manifest_path) {
        return Ok(existing);
    }

    let candidates = legacy::current_platform_candidates()
        .into_iter()
        .map(PathBuf::from)
        .filter(|path| path != &app_directory)
        .collect::<Vec<_>>();
    let legacy_directory = candidates.iter().find(|path| path.is_dir()).cloned();
    let manifest_match = find_legacy_manifest(&candidates);
    let manifest = manifest_match.as_ref().map(|(_, value)| value.clone());
    let manifest_directory = manifest_match.as_ref().map(|(path, _)| path.as_path());
    let evidence_directory = manifest_directory.or(legacy_directory.as_deref());
    let legacy_evidence_exists = evidence_directory.is_some();

    if legacy_evidence_exists {
        if let Some(value) = manifest.as_ref() {
            write_json_atomic(&imported_manifest_path, value)?;
        }
        copy_valid_autosave_once(&app_directory, evidence_directory, manifest.as_ref());
        import_recent_project_snapshots_once(&app_directory, manifest.as_ref());
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
    use super::MigrationManifestV1;
    use serde_json::json;

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
}
