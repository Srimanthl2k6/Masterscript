use serde::de::DeserializeOwned;
use serde::Serialize;
use std::fs;
use std::io::{self, Write};
use std::path::Path;
use tempfile::NamedTempFile;

pub fn write_bytes_atomic(file_path: &Path, bytes: &[u8]) -> io::Result<()> {
    let parent = file_path
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "File has no parent"))?;
    fs::create_dir_all(parent)?;

    let mut temporary = NamedTempFile::new_in(parent)?;
    temporary.write_all(bytes)?;
    temporary.flush()?;
    temporary.as_file().sync_all()?;
    temporary.persist(file_path).map_err(|error| error.error)?;
    Ok(())
}

pub fn write_json_atomic<T: Serialize>(file_path: &Path, value: &T) -> io::Result<()> {
    let mut bytes = serde_json::to_vec_pretty(value)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    bytes.push(b'\n');
    write_bytes_atomic(file_path, &bytes)
}

pub fn write_compact_json_atomic<T: Serialize>(file_path: &Path, value: &T) -> io::Result<()> {
    let bytes = serde_json::to_vec(value)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    write_bytes_atomic(file_path, &bytes)
}

pub fn read_json<T: DeserializeOwned>(file_path: &Path) -> io::Result<T> {
    let raw = fs::read(file_path)?;
    serde_json::from_slice(&raw).map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))
}

#[cfg(test)]
mod tests {
    use super::{read_json, write_compact_json_atomic, write_json_atomic};
    use serde::{Deserialize, Serialize};
    use tempfile::tempdir;

    #[derive(Debug, Deserialize, PartialEq, Serialize)]
    struct Example {
        value: u8,
    }

    #[test]
    fn atomically_replaces_existing_json() {
        let directory = tempdir().expect("temp directory");
        let file_path = directory.path().join("state.json");

        write_json_atomic(&file_path, &Example { value: 1 }).expect("first write");
        write_json_atomic(&file_path, &Example { value: 2 }).expect("replacement write");

        assert_eq!(
            read_json::<Example>(&file_path).expect("read replacement"),
            Example { value: 2 }
        );
    }

    #[test]
    fn compact_json_avoids_pretty_print_overhead() {
        let directory = tempdir().expect("temp directory");
        let file_path = directory.path().join("compact.json");

        write_compact_json_atomic(&file_path, &Example { value: 7 }).expect("compact write");

        assert_eq!(
            std::fs::read_to_string(file_path).expect("read"),
            r#"{"value":7}"#
        );
    }
}
