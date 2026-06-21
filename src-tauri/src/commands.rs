use crate::lan::{self, LanRelayState};
use crate::legacy::InstallState;
use crate::migration::{self, BootstrapInstallationResult};
use crate::models::{
    AutosaveReadResult, BinaryImportResult, LanHostOptions, LanHostResult, LanJoinOptions,
    LanJoinResult, OpenProjectResult, OperationResult, TextImportResult,
};
use crate::persistence::{read_json_value, write_bytes_atomic, write_json_atomic};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use serde_json::Value;
use std::env;
use std::path::{Path, PathBuf};
use tauri::{Manager, State};

const AUTOSAVE_FILE: &str = "autosave.msproj.json";

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

fn absolute_path(path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);
    if path.is_absolute() {
        return Ok(path);
    }
    env::current_dir()
        .map(|directory| directory.join(path))
        .map_err(|error| error.to_string())
}

fn autosave_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(AUTOSAVE_FILE))
        .map_err(|error| error.to_string())
}

fn save_json(path: &Path, project: &Value) -> OperationResult {
    match write_json_atomic(path, project) {
        Ok(()) => OperationResult::success(Some(path.to_string_lossy().into_owned())),
        Err(error) => OperationResult::failure(error.to_string()),
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
            path: None,
            cancelled: Some(true),
            error: None,
        };
    };
    let path = file.path().to_owned();
    match tokio::fs::read_to_string(&path).await {
        Ok(content) => TextImportResult {
            ok: true,
            content: Some(content),
            path: Some(path.to_string_lossy().into_owned()),
            cancelled: None,
            error: None,
        },
        Err(error) => TextImportResult {
            ok: false,
            content: None,
            path: None,
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
        Ok(()) => OperationResult::success(Some(path.to_string_lossy().into_owned())),
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
        Ok(()) => OperationResult::success(Some(path.to_string_lossy().into_owned())),
        Err(error) => OperationResult::failure(error.to_string()),
    }
}

#[tauri::command]
pub fn project_autosave(app: tauri::AppHandle, project: Value) -> OperationResult {
    match autosave_path(&app) {
        Ok(path) => save_json(&path, &project),
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
pub async fn project_save_file(project: Value, title: String) -> OperationResult {
    let default_name = format!("{}.msproj.json", normalize_file_name(&title));
    let selected = rfd::AsyncFileDialog::new()
        .set_title("Save MasterScript project")
        .set_file_name(&default_name)
        .add_filter("JSON Files", &["json"])
        .save_file()
        .await;
    selected
        .map(|file| save_json(file.path(), &project))
        .unwrap_or_else(OperationResult::cancelled)
}

#[tauri::command]
pub fn project_save_path(file_path: String, project: Value) -> OperationResult {
    let path = match absolute_path(&file_path) {
        Ok(path) => path,
        Err(error) => return OperationResult::failure(error),
    };
    if !path
        .to_string_lossy()
        .to_ascii_lowercase()
        .ends_with(".msproj.json")
    {
        return OperationResult::failure("Project path must end with .msproj.json");
    }
    save_json(&path, &project)
}

#[tauri::command]
pub async fn project_open_file() -> OpenProjectResult {
    let selected = rfd::AsyncFileDialog::new()
        .set_title("Open MasterScript project")
        .add_filter("JSON Files", &["json"])
        .pick_file()
        .await;
    let Some(file) = selected else {
        return OpenProjectResult {
            ok: false,
            project: None,
            path: None,
            cancelled: Some(true),
            error: None,
        };
    };
    project_open_path(file.path().to_string_lossy().into_owned())
}

#[tauri::command]
pub fn project_open_path(file_path: String) -> OpenProjectResult {
    let path = match absolute_path(&file_path) {
        Ok(path) => path,
        Err(error) => {
            return OpenProjectResult {
                ok: false,
                project: None,
                path: None,
                cancelled: None,
                error: Some(error),
            }
        }
    };
    match read_json_value(&path) {
        Ok(project) => OpenProjectResult {
            ok: true,
            project: Some(project),
            path: Some(path.to_string_lossy().into_owned()),
            cancelled: None,
            error: None,
        },
        Err(error) => OpenProjectResult {
            ok: false,
            project: None,
            path: None,
            cancelled: None,
            error: Some(error.to_string()),
        },
    }
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
            path: None,
            cancelled: Some(true),
            error: None,
        };
    };
    let path = file.path().to_owned();
    match tokio::fs::read(&path).await {
        Ok(bytes) => BinaryImportResult {
            ok: true,
            base64: Some(STANDARD.encode(bytes)),
            path: Some(path.to_string_lossy().into_owned()),
            cancelled: None,
            error: None,
        },
        Err(error) => BinaryImportResult {
            ok: false,
            base64: None,
            path: None,
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
pub async fn collaboration_lan_stop(
    state: State<'_, LanRelayState>,
) -> Result<OperationResult, String> {
    state.stop().await;
    Ok(OperationResult::success(None))
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
