use serde_json::Value;
use std::fs;
use std::io::{self, Cursor};
use std::path::{Path, PathBuf};
use zip::ZipArchive;

pub const TEXT_IMPORT_LIMIT: usize = 10 * 1024 * 1024;
pub const DOCX_COMPRESSED_LIMIT: usize = 25 * 1024 * 1024;
pub const DOCX_EXPANDED_LIMIT: u64 = 100 * 1024 * 1024;
pub const DOCX_ENTRY_LIMIT: usize = 10_000;
pub const DOCX_COMPRESSION_RATIO_LIMIT: u64 = 200;
pub const PROJECT_JSON_LIMIT: usize = 50 * 1024 * 1024;
pub const MIGRATION_MANIFEST_LIMIT: usize = 10 * 1024 * 1024;
pub const GENERATED_TEXT_LIMIT: usize = 20 * 1024 * 1024;
pub const EXPORT_TEXT_LIMIT: usize = GENERATED_TEXT_LIMIT;
pub const EXPORT_BINARY_LIMIT: usize = 100 * 1024 * 1024;
pub const MAX_BASE64_EXPORT_BYTES: usize = ((EXPORT_BINARY_LIMIT + 2) / 3) * 4;
pub const PROJECT_BLOCK_LIMIT: usize = 50_000;
const PROJECT_SNAPSHOT_LIMIT: usize = 60;
const JSON_DEPTH_LIMIT: usize = 32;
const JSON_NODE_LIMIT: usize = 500_000;

#[derive(Clone, Copy)]
pub struct DocxEntryStat {
    pub compressed: u64,
    pub expanded: u64,
}

fn invalid_data(message: impl Into<String>) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message.into())
}

pub fn read_file_bounded(path: &Path, limit: usize) -> io::Result<Vec<u8>> {
    let metadata = fs::symlink_metadata(path)?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(invalid_data("Input must be a regular file"));
    }
    if metadata.len() > limit as u64 {
        return Err(invalid_data(format!(
            "Input exceeds the {} byte limit",
            limit
        )));
    }
    let bytes = fs::read(path)?;
    if bytes.len() > limit {
        return Err(invalid_data(format!(
            "Input exceeds the {} byte limit",
            limit
        )));
    }
    Ok(bytes)
}

pub fn validate_docx_entry_stats(entries: &[DocxEntryStat]) -> io::Result<()> {
    if entries.len() > DOCX_ENTRY_LIMIT {
        return Err(invalid_data(
            "DOCX archive contains more than 10,000 entries",
        ));
    }
    let mut expanded_total = 0_u64;
    let mut compressed_total = 0_u64;
    for entry in entries {
        expanded_total = expanded_total
            .checked_add(entry.expanded)
            .ok_or_else(|| invalid_data("DOCX expanded size overflow"))?;
        compressed_total = compressed_total
            .checked_add(entry.compressed)
            .ok_or_else(|| invalid_data("DOCX compressed size overflow"))?;
        if expanded_total > DOCX_EXPANDED_LIMIT {
            return Err(invalid_data("DOCX expanded size exceeds 100 MiB"));
        }
        if entry.expanded > 0
            && (entry.compressed == 0
                || entry.expanded
                    > entry
                        .compressed
                        .saturating_mul(DOCX_COMPRESSION_RATIO_LIMIT))
        {
            return Err(invalid_data(
                "DOCX entry exceeds the 200:1 compression ratio",
            ));
        }
    }
    if expanded_total > 0
        && (compressed_total == 0
            || expanded_total > compressed_total.saturating_mul(DOCX_COMPRESSION_RATIO_LIMIT))
    {
        return Err(invalid_data(
            "DOCX archive exceeds the 200:1 compression ratio",
        ));
    }
    Ok(())
}

pub fn validate_docx_archive(bytes: &[u8]) -> io::Result<()> {
    if bytes.is_empty() {
        return Err(invalid_data("DOCX input was empty"));
    }
    if bytes.len() > DOCX_COMPRESSED_LIMIT {
        return Err(invalid_data("DOCX compressed size exceeds 25 MiB"));
    }

    let mut archive =
        ZipArchive::new(Cursor::new(bytes)).map_err(|error| invalid_data(error.to_string()))?;
    let mut entry_stats = Vec::with_capacity(archive.len().min(DOCX_ENTRY_LIMIT + 1));
    let mut has_content_types = false;
    let mut has_document = false;

    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_err(|error| invalid_data(error.to_string()))?;
        let name = entry
            .enclosed_name()
            .ok_or_else(|| invalid_data("DOCX archive contains an unsafe entry path"))?;
        if entry
            .unix_mode()
            .is_some_and(|mode| mode & 0o170000 == 0o120000)
        {
            return Err(invalid_data("DOCX archive links are not allowed"));
        }

        entry_stats.push(DocxEntryStat {
            expanded: entry.size(),
            compressed: entry.compressed_size(),
        });

        has_content_types |= name == Path::new("[Content_Types].xml");
        has_document |= name == Path::new("word/document.xml");
    }

    validate_docx_entry_stats(&entry_stats)?;
    if !has_content_types || !has_document {
        return Err(invalid_data(
            "DOCX archive is missing required document parts",
        ));
    }
    Ok(())
}

fn validate_block_array(value: Option<&Value>, label: &str) -> io::Result<()> {
    let blocks = value
        .and_then(Value::as_array)
        .ok_or_else(|| invalid_data(format!("{label} must be an array")))?;
    if blocks.len() > PROJECT_BLOCK_LIMIT {
        return Err(invalid_data(format!(
            "{label} exceeds the 50,000 block limit"
        )));
    }
    for block in blocks {
        let object = block
            .as_object()
            .ok_or_else(|| invalid_data(format!("{label} contains a non-object block")))?;
        for key in ["id", "type", "text"] {
            if !object.get(key).is_some_and(Value::is_string) {
                return Err(invalid_data(format!(
                    "{label} block is missing string field {key}"
                )));
            }
        }
    }
    Ok(())
}

fn validate_json_budget(
    value: &Value,
    depth: usize,
    nodes: &mut usize,
    text_bytes: &mut usize,
) -> io::Result<()> {
    if depth > JSON_DEPTH_LIMIT {
        return Err(invalid_data(
            "Project JSON nesting exceeds the supported depth",
        ));
    }
    *nodes = nodes
        .checked_add(1)
        .ok_or_else(|| invalid_data("Project JSON node count overflow"))?;
    if *nodes > JSON_NODE_LIMIT {
        return Err(invalid_data("Project JSON contains too many values"));
    }
    match value {
        Value::String(text) => {
            *text_bytes = text_bytes
                .checked_add(text.len())
                .ok_or_else(|| invalid_data("Project text size overflow"))?;
            if *text_bytes > GENERATED_TEXT_LIMIT {
                return Err(invalid_data("Project text exceeds 20 MiB"));
            }
        }
        Value::Array(values) => {
            for value in values {
                validate_json_budget(value, depth + 1, nodes, text_bytes)?;
            }
        }
        Value::Object(values) => {
            for (key, value) in values {
                *text_bytes = text_bytes
                    .checked_add(key.len())
                    .ok_or_else(|| invalid_data("Project text size overflow"))?;
                if *text_bytes > GENERATED_TEXT_LIMIT {
                    return Err(invalid_data("Project text exceeds 20 MiB"));
                }
                validate_json_budget(value, depth + 1, nodes, text_bytes)?;
            }
        }
        _ => {}
    }
    Ok(())
}

pub fn validate_project_value(project: &Value) -> io::Result<()> {
    let object = project
        .as_object()
        .ok_or_else(|| invalid_data("Project must be a JSON object"))?;
    if object.get("schemaVersion").and_then(Value::as_u64) != Some(1) {
        return Err(invalid_data("Unsupported project schema version"));
    }
    if !object.get("id").is_some_and(Value::is_string)
        || !object.get("meta").is_some_and(Value::is_object)
    {
        return Err(invalid_data(
            "Project is missing required identity or metadata",
        ));
    }
    validate_block_array(object.get("blocks"), "Project blocks")?;

    if let Some(snapshots) = object.get("revisionSnapshots") {
        let snapshots = snapshots
            .as_array()
            .ok_or_else(|| invalid_data("Revision snapshots must be an array"))?;
        if snapshots.len() > PROJECT_SNAPSHOT_LIMIT {
            return Err(invalid_data(
                "Project contains more than 60 revision snapshots",
            ));
        }
        for snapshot in snapshots {
            validate_block_array(snapshot.get("blocks"), "Revision snapshot blocks")?;
        }
    }

    let mut nodes = 0;
    let mut text_bytes = 0;
    validate_json_budget(project, 0, &mut nodes, &mut text_bytes)
}

pub fn read_project_file(path: &Path) -> io::Result<Value> {
    let bytes = read_file_bounded(path, PROJECT_JSON_LIMIT)?;
    let project =
        serde_json::from_slice::<Value>(&bytes).map_err(|error| invalid_data(error.to_string()))?;
    validate_project_value(&project)?;
    Ok(project)
}

pub fn read_manifest_file<T: serde::de::DeserializeOwned>(path: &Path) -> io::Result<T> {
    let bytes = read_file_bounded(path, MIGRATION_MANIFEST_LIMIT)?;
    serde_json::from_slice(&bytes).map_err(|error| invalid_data(error.to_string()))
}

pub fn read_json_value_bounded(path: &Path, limit: usize) -> io::Result<Value> {
    let bytes = read_file_bounded(path, limit)?;
    serde_json::from_slice(&bytes).map_err(|error| invalid_data(error.to_string()))
}

pub fn validate_serialized_size<T: serde::Serialize>(value: &T, limit: usize) -> io::Result<()> {
    let bytes = serde_json::to_vec(value).map_err(|error| invalid_data(error.to_string()))?;
    if bytes.len() > limit {
        return Err(invalid_data(format!(
            "Serialized data exceeds the {} byte limit",
            limit
        )));
    }
    Ok(())
}

pub fn validate_trusted_legacy_autosave(
    legacy_directory: &Path,
    candidate: &Path,
) -> io::Result<PathBuf> {
    if candidate.file_name().and_then(|name| name.to_str()) != Some("autosave.msproj.json") {
        return Err(invalid_data("Legacy autosave filename is not trusted"));
    }
    if fs::symlink_metadata(candidate)?.file_type().is_symlink() {
        return Err(invalid_data("Legacy autosave links are not allowed"));
    }
    let root = legacy_directory.canonicalize()?;
    let candidate = candidate.canonicalize()?;
    if candidate.parent() != Some(root.as_path()) {
        return Err(invalid_data(
            "Legacy autosave is outside the canonical MasterScript directory",
        ));
    }
    Ok(candidate)
}

#[cfg(test)]
mod tests {
    use super::{
        read_file_bounded, validate_docx_archive, validate_docx_entry_stats,
        validate_project_value, validate_serialized_size, validate_trusted_legacy_autosave,
        DocxEntryStat, DOCX_COMPRESSED_LIMIT, DOCX_ENTRY_LIMIT, DOCX_EXPANDED_LIMIT,
        PROJECT_BLOCK_LIMIT, TEXT_IMPORT_LIMIT,
    };
    use serde_json::json;
    use std::fs;
    use std::io::{Cursor, Write};
    use tempfile::tempdir;
    use zip::write::SimpleFileOptions;
    use zip::ZipWriter;

    fn docx_with_entries(entries: &[(&str, &[u8])]) -> Vec<u8> {
        let mut bytes = Cursor::new(Vec::new());
        {
            let mut writer = ZipWriter::new(&mut bytes);
            for (name, content) in entries {
                writer
                    .start_file(*name, SimpleFileOptions::default())
                    .expect("start file");
                writer.write_all(content).expect("write entry");
            }
            writer.finish().expect("finish zip");
        }
        bytes.into_inner()
    }

    fn valid_project(block_count: usize) -> serde_json::Value {
        json!({
            "id": "project-1",
            "schemaVersion": 1,
            "meta": { "title": "Bounded project" },
            "blocks": (0..block_count)
                .map(|index| json!({
                    "id": format!("block-{index}"),
                    "type": "action",
                    "text": "line",
                    "revision": null
                }))
                .collect::<Vec<_>>(),
            "revisionSnapshots": []
        })
    }

    #[test]
    fn reads_text_inputs_only_up_to_the_ten_mib_limit() {
        let directory = tempdir().expect("temp directory");
        let exact = directory.path().join("exact.fountain");
        let oversized = directory.path().join("oversized.fdx");
        fs::write(&exact, vec![b'a'; TEXT_IMPORT_LIMIT]).expect("exact file");
        fs::write(&oversized, vec![b'a'; TEXT_IMPORT_LIMIT + 1]).expect("oversized file");

        assert_eq!(
            read_file_bounded(&exact, TEXT_IMPORT_LIMIT)
                .expect("exact read")
                .len(),
            TEXT_IMPORT_LIMIT
        );
        assert!(read_file_bounded(&oversized, TEXT_IMPORT_LIMIT).is_err());
    }

    #[test]
    fn validates_docx_zip_structure_and_rejects_compressed_oversize() {
        let valid = docx_with_entries(&[
            ("[Content_Types].xml", b"<Types/>"),
            ("word/document.xml", b"<document/>"),
        ]);
        validate_docx_archive(&valid).expect("valid docx");

        let oversized = vec![0_u8; DOCX_COMPRESSED_LIMIT + 1];
        assert!(validate_docx_archive(&oversized).is_err());
        assert!(validate_docx_archive(b"not-a-zip").is_err());
    }

    #[test]
    fn enforces_docx_entry_expansion_and_ratio_limits_at_the_boundary() {
        let exact_entries = vec![
            DocxEntryStat {
                compressed: 1,
                expanded: 1,
            };
            DOCX_ENTRY_LIMIT
        ];
        validate_docx_entry_stats(&exact_entries).expect("exact entry limit");

        let mut too_many = exact_entries;
        too_many.push(DocxEntryStat {
            compressed: 1,
            expanded: 1,
        });
        assert!(validate_docx_entry_stats(&too_many).is_err());
        validate_docx_entry_stats(&[DocxEntryStat {
            compressed: 1024 * 1024,
            expanded: DOCX_EXPANDED_LIMIT,
        }])
        .expect("exact expanded limit");
        assert!(validate_docx_entry_stats(&[DocxEntryStat {
            compressed: 1024 * 1024,
            expanded: DOCX_EXPANDED_LIMIT + 1,
        }])
        .is_err());
        assert!(validate_docx_entry_stats(&[DocxEntryStat {
            compressed: 1,
            expanded: 201,
        }])
        .is_err());
    }

    #[test]
    fn bounds_project_blocks_and_requires_the_supported_schema() {
        validate_project_value(&valid_project(PROJECT_BLOCK_LIMIT)).expect("exact block limit");
        assert!(validate_project_value(&valid_project(PROJECT_BLOCK_LIMIT + 1)).is_err());

        let mut unsupported = valid_project(1);
        unsupported["schemaVersion"] = json!(2);
        assert!(validate_project_value(&unsupported).is_err());
    }

    #[test]
    fn accepts_only_the_exact_canonical_autosave_inside_a_legacy_root() {
        let legacy = tempdir().expect("legacy directory");
        let autosave = legacy.path().join("autosave.msproj.json");
        let other = legacy.path().join("other.msproj.json");
        fs::write(&autosave, serde_json::to_vec(&valid_project(1)).unwrap()).expect("autosave");
        fs::write(&other, serde_json::to_vec(&valid_project(1)).unwrap()).expect("other");

        assert_eq!(
            validate_trusted_legacy_autosave(legacy.path(), &autosave).expect("trusted autosave"),
            autosave.canonicalize().expect("canonical autosave")
        );
        assert!(validate_trusted_legacy_autosave(legacy.path(), &other).is_err());

        let outside = tempdir().expect("outside directory");
        let outside_autosave = outside.path().join("autosave.msproj.json");
        fs::write(
            &outside_autosave,
            serde_json::to_vec(&valid_project(1)).unwrap(),
        )
        .expect("outside autosave");
        assert!(validate_trusted_legacy_autosave(legacy.path(), &outside_autosave).is_err());
    }

    #[test]
    fn bounds_serialized_project_collections_before_persistence() {
        assert!(validate_serialized_size(&json!({"value": "short"}), 64).is_ok());
        assert!(validate_serialized_size(&json!({"value": "too long"}), 8).is_err());
    }
}
