fn main() {
    // Custom build logic can go here
    println!("cargo:rerun-if-changed=build.rs");
}
