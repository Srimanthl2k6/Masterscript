mod commands;
mod file_grants;
mod lan;
mod legacy;
mod migration;
mod models;
mod persistence;

use commands::{
    bootstrap_installation, collaboration_lan_host, collaboration_lan_join,
    collaboration_lan_status, collaboration_lan_stop, collaboration_lan_transport_close,
    collaboration_lan_transport_open, collaboration_lan_transport_send, installation_get_state,
    installation_set_tutorial_completed, project_autosave, project_export_docx, project_export_fdx,
    project_export_fountain, project_export_pdf, project_import_docx, project_import_fdx,
    project_import_fountain, project_open_file, project_open_ref, project_read_autosave,
    project_read_recent_snapshots, project_save_file, project_save_ref,
    project_write_recent_snapshot,
};
use lan::{LanRelayState, LanTransportState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(LanRelayState::default())
        .manage(LanTransportState::default())
        .invoke_handler(tauri::generate_handler![
            project_autosave,
            project_read_autosave,
            project_read_recent_snapshots,
            project_write_recent_snapshot,
            project_save_file,
            project_save_ref,
            project_open_file,
            project_open_ref,
            project_export_fountain,
            project_import_fountain,
            project_import_fdx,
            project_export_fdx,
            project_import_docx,
            project_export_docx,
            project_export_pdf,
            collaboration_lan_host,
            collaboration_lan_join,
            collaboration_lan_transport_open,
            collaboration_lan_transport_send,
            collaboration_lan_transport_close,
            collaboration_lan_stop,
            collaboration_lan_status,
            bootstrap_installation,
            installation_get_state,
            installation_set_tutorial_completed,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MasterScript");
}
