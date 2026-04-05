pub fn get_core_path() -> std::path::PathBuf {
    let mut path = dirs::data_local_dir().expect("Failed to get data local dir");
    path.push("mineager");

    path
}