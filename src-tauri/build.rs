fn main() {
    const COMMANDS: &[&str] = &[
        "project_autosave",
        "project_read_autosave",
        "project_read_recent_snapshots",
        "project_write_recent_snapshot",
        "project_save_file",
        "project_save_ref",
        "project_open_file",
        "project_open_ref",
        "project_export_fountain",
        "project_import_fountain",
        "project_import_fdx",
        "project_export_fdx",
        "project_import_docx",
        "project_export_docx",
        "project_export_pdf",
        "collaboration_lan_host",
        "collaboration_lan_join",
        "collaboration_lan_transport_open",
        "collaboration_lan_transport_send",
        "collaboration_lan_transport_close",
        "collaboration_lan_stop",
        "collaboration_lan_status",
        "bootstrap_installation",
        "installation_get_state",
        "installation_set_tutorial_completed",
    ];

    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("failed to build MasterScript Tauri context");
}
