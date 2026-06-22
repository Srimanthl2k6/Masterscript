use crate::models::ProjectFileRef;
use crate::persistence::{read_json, write_compact_json_atomic};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use tauri::Manager;

const FILE_GRANTS_FILE: &str = "file-grants-v1.json";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileGrantRecord {
    canonical_path: String,
    display_path: String,
    #[serde(default)]
    revoked: bool,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PersistedFileGrants {
    schema_version: u8,
    grants: HashMap<String, FileGrantRecord>,
}

impl Default for PersistedFileGrants {
    fn default() -> Self {
        Self {
            schema_version: 1,
            grants: HashMap::new(),
        }
    }
}

pub struct FileGrantRegistry {
    storage_path: PathBuf,
    persisted: PersistedFileGrants,
}

fn invalid_input(message: impl Into<String>) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, message.into())
}

fn is_project_path(path: &Path) -> bool {
    path.to_string_lossy()
        .to_ascii_lowercase()
        .ends_with(".msproj.json")
}

fn reject_symlink(path: &Path) -> io::Result<()> {
    if fs::symlink_metadata(path)?.file_type().is_symlink() {
        return Err(invalid_input(
            "Symbolic-link project grants are not allowed",
        ));
    }
    Ok(())
}

fn canonical_write_target(path: &Path) -> io::Result<PathBuf> {
    if !path.is_absolute() {
        return Err(invalid_input("Project grant path must be absolute"));
    }
    if !is_project_path(path) {
        return Err(invalid_input("Project path must end with .msproj.json"));
    }
    if path.exists() {
        reject_symlink(path)?;
        return path.canonicalize();
    }
    let parent = path
        .parent()
        .ok_or_else(|| invalid_input("Project path has no parent"))?
        .canonicalize()?;
    let file_name = path
        .file_name()
        .ok_or_else(|| invalid_input("Project path has no file name"))?;
    Ok(parent.join(file_name))
}

fn create_grant_id() -> String {
    let mut bytes = [0_u8; 32];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

impl FileGrantRegistry {
    pub fn load(storage_path: &Path) -> io::Result<Self> {
        let persisted = match read_json::<PersistedFileGrants>(storage_path) {
            Ok(value) if value.schema_version == 1 => value,
            Ok(_) => return Err(invalid_input("Unsupported file-grant schema version")),
            Err(error) if error.kind() == io::ErrorKind::NotFound => PersistedFileGrants::default(),
            Err(error) => return Err(error),
        };
        Ok(Self {
            storage_path: storage_path.to_owned(),
            persisted,
        })
    }

    pub fn load_for_app(app: &tauri::AppHandle) -> io::Result<Self> {
        let app_directory = app.path().app_data_dir().map_err(io::Error::other)?;
        Self::load_in_directory(&app_directory)
    }

    pub fn load_in_directory(app_directory: &Path) -> io::Result<Self> {
        Self::load(&app_directory.join(FILE_GRANTS_FILE))
    }

    fn persist(&self) -> io::Result<()> {
        write_compact_json_atomic(&self.storage_path, &self.persisted)
    }

    fn issue(
        &mut self,
        canonical_path: PathBuf,
        display_path: &Path,
    ) -> io::Result<ProjectFileRef> {
        if let Some((grant_id, record)) = self.persisted.grants.iter().find(|(_, record)| {
            !record.revoked && Path::new(&record.canonical_path) == canonical_path
        }) {
            return Ok(ProjectFileRef {
                grant_id: grant_id.clone(),
                display_path: record.display_path.clone(),
            });
        }

        let grant_id = create_grant_id();
        let display_path = display_path.to_string_lossy().into_owned();
        self.persisted.grants.insert(
            grant_id.clone(),
            FileGrantRecord {
                canonical_path: canonical_path.to_string_lossy().into_owned(),
                display_path: display_path.clone(),
                revoked: false,
            },
        );
        self.persist()?;
        Ok(ProjectFileRef {
            grant_id,
            display_path,
        })
    }

    pub fn issue_existing(&mut self, path: &Path) -> io::Result<ProjectFileRef> {
        if !path.is_absolute() {
            return Err(invalid_input("Project grant path must be absolute"));
        }
        if !is_project_path(path) {
            return Err(invalid_input("Project path must end with .msproj.json"));
        }
        reject_symlink(path)?;
        if !path.is_file() {
            return Err(invalid_input("Project grant target must be a file"));
        }
        self.issue(path.canonicalize()?, path)
    }

    pub fn issue_save(&mut self, path: &Path) -> io::Result<ProjectFileRef> {
        let canonical = canonical_write_target(path)?;
        self.issue(canonical, path)
    }

    fn active_record(&self, grant_id: &str) -> io::Result<&FileGrantRecord> {
        let record =
            self.persisted.grants.get(grant_id).ok_or_else(|| {
                io::Error::new(io::ErrorKind::PermissionDenied, "Unknown file grant")
            })?;
        if record.revoked {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "File grant has been revoked",
            ));
        }
        Ok(record)
    }

    pub fn resolve_existing(&self, grant_id: &str) -> io::Result<PathBuf> {
        let record = self.active_record(grant_id)?;
        let stored = PathBuf::from(&record.canonical_path);
        if !stored.is_absolute() || !is_project_path(&stored) {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "File grant path is invalid",
            ));
        }
        reject_symlink(&stored)?;
        let canonical = stored.canonicalize()?;
        if canonical != stored || !canonical.is_file() {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "File grant no longer matches its canonical target",
            ));
        }
        Ok(canonical)
    }

    pub fn resolve_for_write(&self, grant_id: &str) -> io::Result<PathBuf> {
        let record = self.active_record(grant_id)?;
        let stored = PathBuf::from(&record.canonical_path);
        let resolved = canonical_write_target(&stored)?;
        if resolved != stored {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "File grant no longer matches its canonical target",
            ));
        }
        Ok(resolved)
    }

    pub fn file_ref(&self, grant_id: &str) -> io::Result<ProjectFileRef> {
        let record = self.active_record(grant_id)?;
        Ok(ProjectFileRef {
            grant_id: grant_id.to_owned(),
            display_path: record.display_path.clone(),
        })
    }

    #[cfg_attr(not(test), allow(dead_code))]
    pub fn revoke(&mut self, grant_id: &str) -> io::Result<()> {
        let record = self
            .persisted
            .grants
            .get_mut(grant_id)
            .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Unknown file grant"))?;
        record.revoked = true;
        self.persist()
    }

    pub fn migrate_recent_projects(&mut self, recent_projects: &mut Value) -> io::Result<()> {
        let Some(entries) = recent_projects.as_array_mut() else {
            return Ok(());
        };
        for entry in entries {
            let Some(object) = entry.as_object_mut() else {
                continue;
            };
            if object.get("fileGrantId").and_then(Value::as_str).is_some()
                || object.get("source").and_then(Value::as_str) != Some("project")
            {
                continue;
            }
            let Some(label) = object.get("label").and_then(Value::as_str) else {
                continue;
            };
            let path = PathBuf::from(label);
            if let Ok(file_ref) = self.issue_existing(&path) {
                object.insert("fileGrantId".into(), Value::String(file_ref.grant_id));
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::FileGrantRegistry;
    use serde_json::json;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn persists_an_opaque_grant_for_an_existing_project() {
        let directory = tempdir().expect("temp directory");
        let project_path = directory.path().join("draft.msproj.json");
        fs::write(&project_path, "{}").expect("project");
        let grants_path = directory.path().join("file-grants-v1.json");

        let mut registry = FileGrantRegistry::load(&grants_path).expect("registry");
        let file_ref = registry
            .issue_existing(&project_path)
            .expect("existing grant");

        assert_ne!(file_ref.grant_id, project_path.to_string_lossy());
        assert_eq!(file_ref.display_path, project_path.to_string_lossy());

        let reloaded = FileGrantRegistry::load(&grants_path).expect("reload");
        assert_eq!(
            reloaded
                .resolve_existing(&file_ref.grant_id)
                .expect("resolved"),
            project_path.canonicalize().expect("canonical project"),
        );
    }

    #[test]
    fn rejects_unknown_relative_and_revoked_grants() {
        let directory = tempdir().expect("temp directory");
        let project_path = directory.path().join("draft.msproj.json");
        fs::write(&project_path, "{}").expect("project");
        let grants_path = directory.path().join("file-grants-v1.json");
        let mut registry = FileGrantRegistry::load(&grants_path).expect("registry");

        assert!(registry.resolve_existing("forged-grant").is_err());

        fs::write(
            &grants_path,
            r#"{"schemaVersion":1,"grants":{"relative":{"canonicalPath":"draft.msproj.json","displayPath":"draft.msproj.json","revoked":false}}}"#,
        )
        .expect("tampered grants");
        let relative = FileGrantRegistry::load(&grants_path).expect("relative registry");
        assert!(relative.resolve_existing("relative").is_err());

        let file_ref = registry
            .issue_existing(&project_path)
            .expect("existing grant");
        registry.revoke(&file_ref.grant_id).expect("revoke");
        assert!(registry.resolve_existing(&file_ref.grant_id).is_err());
    }

    #[test]
    fn issues_a_write_grant_only_beneath_a_canonical_existing_parent() {
        let directory = tempdir().expect("temp directory");
        let grants_path = directory.path().join("file-grants-v1.json");
        let target = directory.path().join("new-draft.msproj.json");
        let mut registry = FileGrantRegistry::load(&grants_path).expect("registry");

        let file_ref = registry.issue_save(&target).expect("save grant");

        assert_eq!(
            registry
                .resolve_for_write(&file_ref.grant_id)
                .expect("write target"),
            target,
        );
        assert!(registry
            .issue_save(&directory.path().join("draft.txt"))
            .is_err());
    }

    #[test]
    fn migrates_only_valid_existing_recent_project_paths() {
        let directory = tempdir().expect("temp directory");
        let project_path = directory.path().join("draft.msproj.json");
        fs::write(&project_path, "{}").expect("project");
        let grants_path = directory.path().join("file-grants-v1.json");
        let mut registry = FileGrantRegistry::load(&grants_path).expect("registry");
        let mut recent_projects = json!([
            {
                "label": project_path.to_string_lossy(),
                "source": "project",
                "updatedAt": "2026-06-22T00:00:00.000Z",
                "projectId": "project-1"
            },
            {
                "label": directory.path().join("missing.msproj.json").to_string_lossy(),
                "source": "project",
                "updatedAt": "2026-06-22T00:00:00.000Z"
            },
            {
                "label": "relative.msproj.json",
                "source": "project",
                "updatedAt": "2026-06-22T00:00:00.000Z"
            }
        ]);

        registry
            .migrate_recent_projects(&mut recent_projects)
            .expect("migration");

        let entries = recent_projects.as_array().expect("entries");
        assert!(entries[0]
            .get("fileGrantId")
            .and_then(|value| value.as_str())
            .is_some());
        assert!(entries[1].get("fileGrantId").is_none());
        assert!(entries[2].get("fileGrantId").is_none());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_a_persisted_grant_whose_path_is_a_symbolic_link() {
        use std::os::unix::fs::symlink;

        let directory = tempdir().expect("temp directory");
        let project_path = directory.path().join("draft.msproj.json");
        let link_path = directory.path().join("linked.msproj.json");
        fs::write(&project_path, "{}").expect("project");
        symlink(&project_path, &link_path).expect("symlink");
        let grants_path = directory.path().join("file-grants-v1.json");
        fs::write(
            &grants_path,
            format!(
                r#"{{"schemaVersion":1,"grants":{{"linked":{{"canonicalPath":{},"displayPath":{},"revoked":false}}}}}}"#,
                serde_json::to_string(&link_path).expect("link path"),
                serde_json::to_string(&link_path).expect("display path"),
            ),
        )
        .expect("tampered grants");

        let registry = FileGrantRegistry::load(&grants_path).expect("registry");
        assert!(registry.resolve_existing("linked").is_err());
    }
}
