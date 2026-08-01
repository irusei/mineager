// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "linux")]
fn has_nvidia_gpu() -> bool {
    std::fs::metadata("/sys/module/nvidia").is_ok()
}

fn main() {
    #[cfg(target_os = "linux")]
    if has_nvidia_gpu() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    mineager_lib::run()
}
