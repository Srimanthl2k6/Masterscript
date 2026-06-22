use crate::file_grants::FileGrantRegistry;
use crate::lan::{self, LanRelayState, LanTransportState};
use crate::legacy::InstallState;
use crate::migration::{self, BootstrapInstallationResult};
use crate::models::{
    AutosaveReadResult, BinaryImportResult, LanHostOptions, LanHostResult, LanJoinOptions,
    LanJoinResult, LanTransportEvent, LanTransportOpenOptions, LanTransportOpenResult,
    OpenProjectResult, OperationResult, ProjectFileRef, TextImportResult,
};
use crate::persistence::{
    read_json_value, write_bytes_atomic, write_compact_json_atomic, write_json_atomic,
};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use serde_json::Value;
use std::path::{Path, PathBuf};
use tauri::ipc::Channel;
use tauri::{Manager, State};

const AUTOSAVE_FILE: &str = "autosave.msproj.json";
const RECENT_PROJECT_SNAPSHOTS_FILE: &str = "recent-project-snapshots-v1.json";
const RECENT_PROJECT_SNAPSHOT_LIMIT: usize = 12;

fn normalize_file_name(value: &str) -> String {
    let normalized = value
        .to_ascii_lowercase()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if normalized.is_empty() {
        "untitled-project".into()
    } else {
        normalized
    }
}

fn autosave_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(AUTOSAVE_FILE))
        .map_err(|error| error.to_string())
}

fn recent_project_snapshots_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(RECENT_PROJECT_SNAPSHOTS_FILE))
        .map_err(|error| error.to_string())
}

fn save_json(path: &Path, project: &Value) -> Result<(), String> {
    write_json_atomic(path, project).map_err(|error| error.to_string())
}

fn open_project_from_ref(
    registry: &FileGrantRegistry,
    file_ref: ProjectFileRef,
) -> OpenProjectResult {
    let path = match registry.resolve_existing(&file_ref.grant_id) {
        Ok(path) => path,
        Err(error) => return OpenProjectResult::failure(error.to_string()),
    };
    match read_json_value(&path) {
        Ok(project) => OpenProjectResult::success(project, file_ref),
        Err(error) => OpenProjectResult::failure(error.to_string()),
    }
}

async fn choose_text_file(title: &str, filter_name: &str, extensions: &[&str]) -> TextImportResult {
    let selected = rfd::AsyncFileDialog::new()
        .set_title(title)
        .add_filter(filter_name, extensions)
        .pick_file()
        .await;
    let Some(file) = selected else {
        return TextImportResult {
            ok: false,
            content: None,
            display_path: None,
            cancelled: Some(true),
            error: None,
        };
    };
    let path = file.path().to_owned();
    match tokio::fs::read_to_string(&path).await {
        Ok(content) => TextImportResult {
            ok: true,
            content: Some(content),
            display_path: Some(path.to_string_lossy().into_owned()),
            cancelled: None,
            error: None,
        },
        Err(error) => TextImportResult {
            ok: false,
            content: None,
            display_path: None,
            cancelled: None,
            error: Some(error.to_string()),
        },
    }
}

async fn export_text(
    dialog_title: &str,
    filter_name: &str,
    extensions: &[&str],
    default_name: String,
    content: String,
) -> OperationResult {
    let selected = rfd::AsyncFileDialog::new()
        .set_title(dialog_title)
        .set_file_name(&default_name)
        .add_filter(filter_name, extensions)
        .save_file()
        .await;
    let Some(file) = selected else {
        return OperationResult::cancelled();
    };
    let path = file.path().to_owned();
    match write_bytes_atomic(&path, content.as_bytes()) {
        Ok(()) => OperationResult::success(),
        Err(error) => OperationResult::failure(error.to_string()),
    }
}

async fn export_binary(
    dialog_title: &str,
    filter_name: &str,
    extension: &str,
    default_name: String,
    base64: String,
) -> OperationResult {
    let bytes = match STANDARD.decode(base64) {
        Ok(bytes) => bytes,
        Err(error) => return OperationResult::failure(error.to_string()),
    };
    let selected = rfd::AsyncFileDialog::new()
        .set_title(dialog_title)
        .set_file_name(&default_name)
        .add_filter(filter_name, &[extension])
        .save_file()
        .await;
    let Some(file) = selected else {
        return OperationResult::cancelled();
    };
    let path = file.path().to_owned();
    match write_bytes_atomic(&path, &bytes) {
        Ok(()) => OperationResult::success(),
        Err(error) => OperationResult::failure(error.to_string()),
    }
}

#[tauri::command]
pub fn project_autosave(app: tauri::AppHandle, project: Value) -> OperationResult {
    match autosave_path(&app) {
        Ok(path) => match write_compact_json_atomic(&path, &project) {
            Ok(()) => OperationResult::success(),
            Err(error) => OperationResult::failure(error.to_string()),
        },
        Err(error) => OperationResult::failure(error),
    }
}

#[tauri::command]
pub fn project_read_autosave(app: tauri::AppHandle) -> AutosaveReadResult {
    let path = match autosave_path(&app) {
        Ok(path) => path,
        Err(error) => {
            return AutosaveReadResult {
                ok: false,
                project: None,
                error: Some(error),
            }
        }
    };
    match read_json_value(&path) {
        Ok(project) => AutosaveReadResult {
            ok: true,
            project: Some(project),
            error: None,
        },
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => AutosaveReadResult {
            ok: true,
            project: None,
            error: None,
        },
        Err(error) => AutosaveReadResult {
            ok: false,
            project: None,
            error: Some(error.to_string()),
        },
    }
}

#[tauri::command]
pub fn project_read_recent_snapshots(app: tauri::AppHandle) -> Result<Value, String> {
    let path = recent_project_snapshots_path(&app)?;
    match read_json_value(&path) {
        Ok(Value::Object(snapshots)) => Ok(Value::Object(snapshots)),
        Ok(_) => Ok(Value::Object(Default::default())),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            Ok(Value::Object(Default::default()))
        }
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn project_write_recent_snapshot(app: tauri::AppHandle, project: Value) -> OperationResult {
    let Some(project_id) = project.get("id").and_then(Value::as_str) else {
        return OperationResult::failure("Recent project snapshot is missing an id");
    };
    let path = match recent_project_snapshots_path(&app) {
        Ok(path) => path,
        Err(error) => return OperationResult::failure(error),
    };
    let mut snapshots = match read_json_value(&path) {
        Ok(Value::Object(value)) => value,
        _ => Default::default(),
    };
    snapshots.insert(project_id.to_owned(), project);

    let mut entries = snapshots.into_iter().collect::<Vec<_>>();
    entries.sort_by(|(_, left), (_, right)| {
        let left_updated = left
            .pointer("/meta/updatedAt")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let right_updated = right
            .pointer("/meta/updatedAt")
            .and_then(Value::as_str)
            .unwrap_or_default();
        right_updated.cmp(left_updated)
    });
    entries.truncate(RECENT_PROJECT_SNAPSHOT_LIMIT);
    let snapshots = serde_json::Map::from_iter(entries);

    match write_compact_json_atomic(&path, &Value::Object(snapshots)) {
        Ok(()) => OperationResult::success(),
        Err(error) => OperationResult::failure(error.to_string()),
    }
}

#[tauri::command]
pub async fn project_save_file(
    app: tauri::AppHandle,
    project: Value,
    title: String,
) -> OperationResult {
    let default_name = format!("{}.msproj.json", normalize_file_name(&title));
    let selected = rfd::AsyncFileDialog::new()
        .set_title("Save MasterScript project")
        .set_file_name(&default_name)
        .add_filter("JSON Files", &["json"])
        .save_file()
        .await;
    let Some(file) = selected else {
        return OperationResult::cancelled();
    };
    let mut registry = match FileGrantRegistry::load_for_app(&app) {
        Ok(registry) => registry,
        Err(error) => return OperationResult::failure(error.to_string()),
    };
    let file_ref = match registry.issue_save(file.path()) {
        Ok(file_ref) => file_ref,
        Err(error) => return OperationResult::failure(error.to_string()),
    };
    match save_json(
        &match registry.resolve_for_write(&file_ref.grant_id) {
            Ok(path) => path,
            Err(error) => return OperationResult::failure(error.to_string()),
        },
        &project,
    ) {
        Ok(()) => OperationResult::success_with_file_ref(file_ref),
        Err(error) => OperationResult::failure(error),
    }
}

#[tauri::command]
pub fn project_save_ref(
    app: tauri::AppHandle,
    grant_id: String,
    project: Value,
) -> OperationResult {
    let registry = match FileGrantRegistry::load_for_app(&app) {
        Ok(registry) => registry,
        Err(error) => return OperationResult::failure(error.to_string()),
    };
    let path = match registry.resolve_for_write(&grant_id) {
        Ok(path) => path,
        Err(error) => return OperationResult::failure(error.to_string()),
    };
    let file_ref = match registry.file_ref(&grant_id) {
        Ok(file_ref) => file_ref,
        Err(error) => return OperationResult::failure(error.to_string()),
    };
    match save_json(&path, &project) {
        Ok(()) => OperationResult::success_with_file_ref(file_ref),
        Err(error) => OperationResult::failure(error),
    }
}

#[tauri::command]
pub async fn project_open_file(app: tauri::AppHandle) -> OpenProjectResult {
    let selected = rfd::AsyncFileDialog::new()
        .set_title("Open MasterScript project")
        .add_filter("JSON Files", &["json"])
        .pick_file()
        .await;
    let Some(file) = selected else {
        return OpenProjectResult::cancelled();
    };
    let mut registry = match FileGrantRegistry::load_for_app(&app) {
        Ok(registry) => registry,
        Err(error) => return OpenProjectResult::failure(error.to_string()),
    };
    let file_ref = match registry.issue_existing(file.path()) {
        Ok(file_ref) => file_ref,
        Err(error) => return OpenProjectResult::failure(error.to_string()),
    };
    open_project_from_ref(&registry, file_ref)
}

#[tauri::command]
pub fn project_open_ref(app: tauri::AppHandle, grant_id: String) -> OpenProjectResult {
    let registry = match FileGrantRegistry::load_for_app(&app) {
        Ok(registry) => registry,
        Err(error) => return OpenProjectResult::failure(error.to_string()),
    };
    let file_ref = match registry.file_ref(&grant_id) {
        Ok(file_ref) => file_ref,
        Err(error) => return OpenProjectResult::failure(error.to_string()),
    };
    open_project_from_ref(&registry, file_ref)
}

#[tauri::command]
pub async fn project_export_fountain(title: String, content: String) -> OperationResult {
    export_text(
        "Export Fountain file",
        "Fountain",
        &["fountain", "txt"],
        format!("{}.fountain", normalize_file_name(&title)),
        content,
    )
    .await
}

#[tauri::command]
pub async fn project_import_fountain() -> TextImportResult {
    choose_text_file("Import Fountain", "Fountain", &["fountain", "txt"]).await
}

#[tauri::command]
pub async fn project_import_fdx() -> TextImportResult {
    choose_text_file("Import Final Draft (FDX)", "FDX", &["fdx", "xml", "txt"]).await
}

#[tauri::command]
pub async fn project_export_fdx(title: String, content: String) -> OperationResult {
    export_text(
        "Export Final Draft (FDX)",
        "Final Draft",
        &["fdx"],
        format!("{}.fdx", normalize_file_name(&title)),
        content,
    )
    .await
}

#[tauri::command]
pub async fn project_import_docx() -> BinaryImportResult {
    let selected = rfd::AsyncFileDialog::new()
        .set_title("Import DOCX")
        .add_filter("Word Documents", &["docx"])
        .pick_file()
        .await;
    let Some(file) = selected else {
        return BinaryImportResult {
            ok: false,
            base64: None,
            display_path: None,
            cancelled: Some(true),
            error: None,
        };
    };
    let path = file.path().to_owned();
    match tokio::fs::read(&path).await {
        Ok(bytes) => BinaryImportResult {
            ok: true,
            base64: Some(STANDARD.encode(bytes)),
            display_path: Some(path.to_string_lossy().into_owned()),
            cancelled: None,
            error: None,
        },
        Err(error) => BinaryImportResult {
            ok: false,
            base64: None,
            display_path: None,
            cancelled: None,
            error: Some(error.to_string()),
        },
    }
}

#[tauri::command]
pub async fn project_export_docx(title: String, base64: String) -> OperationResult {
    export_binary(
        "Export DOCX",
        "Word Documents",
        "docx",
        format!("{}.docx", normalize_file_name(&title)),
        base64,
    )
    .await
}

#[tauri::command]
pub async fn project_export_pdf(title: String, base64: String) -> OperationResult {
    export_binary(
        "Export PDF",
        "PDF Documents",
        "pdf",
        format!("{}.pdf", normalize_file_name(&title)),
        base64,
    )
    .await
}

#[tauri::command]
pub async fn collaboration_lan_host(
    state: State<'_, LanRelayState>,
    options: LanHostOptions,
) -> Result<LanHostResult, String> {
    Ok(state.host(options).await)
}

#[tauri::command]
pub async fn collaboration_lan_join(options: LanJoinOptions) -> LanJoinResult {
    lan::validate_join(options)
}

#[tauri::command]
pub async fn collaboration_lan_transport_open(
    state: State<'_, LanTransportState>,
    options: LanTransportOpenOptions,
    on_event: Channel<LanTransportEvent>,
) -> Result<LanTransportOpenResult, String> {
    Ok(state.open(options, on_event).await)
}

#[tauri::command]
pub async fn collaboration_lan_transport_send(
    state: State<'_, LanTransportState>,
    session_id: String,
    payload: String,
) -> Result<OperationResult, String> {
    Ok(state.send(&session_id, payload).await)
}

#[tauri::command]
pub async fn collaboration_lan_transport_close(
    state: State<'_, LanTransportState>,
    session_id: String,
) -> Result<OperationResult, String> {
    Ok(state.close(&session_id).await)
}

#[tauri::command]
pub async fn collaboration_lan_stop(
    state: State<'_, LanRelayState>,
    transport_state: State<'_, LanTransportState>,
) -> Result<OperationResult, String> {
    transport_state.stop_all().await;
    state.stop().await;
    Ok(OperationResult::success())
}

#[tauri::command]
pub async fn collaboration_lan_status(
    state: State<'_, LanRelayState>,
) -> Result<LanHostResult, String> {
    Ok(state.status().await)
}

#[tauri::command]
pub fn bootstrap_installation(
    app: tauri::AppHandle,
) -> Result<BootstrapInstallationResult, String> {
    migration::bootstrap(&app).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn installation_get_state(app: tauri::AppHandle) -> Result<InstallState, String> {
    migration::get_install_state(&app).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn installation_set_tutorial_completed(
    app: tauri::AppHandle,
    completed: bool,
) -> Result<(), String> {
    migration::set_tutorial_completed(&app, completed).map_err(|error| error.to_string())
}
