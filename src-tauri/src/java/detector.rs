use crate::minecraft::versions::compare_versions;

#[derive(Debug, PartialEq, Eq)] // for tests
pub enum JreVersion {
    Java8,
    Java16,
    Java17,
    Java21,
    Java25,
}

pub fn get_jre_version(minecraft_version: &str) -> JreVersion {
    // minecraft version <= 1.16.5          - java 8
    //           1.16.5 < version <= 1.17.1 - java 16
    //           1.18 <= version <= 1.20.4  - java 17
    //           1.20.5 <= version <= 1.21.11 - java 21
    //           26.1 <= version               - java 25

    if compare_versions("1.16.5", minecraft_version) >= 0 {
        JreVersion::Java8
    } else if compare_versions("1.17.1", minecraft_version) >= 0 {
        JreVersion::Java16
    } else if compare_versions("1.20.4", minecraft_version) >= 0 {
        JreVersion::Java17
    } else if compare_versions("1.21.11", minecraft_version) >= 0 {
        JreVersion::Java21
    } else {
        JreVersion::Java25
    }
}       

#[cfg(test)]
mod tests {
    use crate::java::detector::{JreVersion, get_jre_version};

    #[test]
    fn test_javadetector_jre8_1() {
        assert_eq!(get_jre_version("1.8"), JreVersion::Java8);
    }
    #[test]
    fn test_javadetector_jre8_2() {
        assert_eq!(get_jre_version("1.16.5"), JreVersion::Java8);
    }
    #[test]
    fn test_javadetector_jre16_1() {
        assert_eq!(get_jre_version("1.17"), JreVersion::Java16);
    }
    #[test]
    fn test_javadetector_jre16_2() {
        assert_eq!(get_jre_version("1.17.1"), JreVersion::Java16);
    }
    #[test]
    fn test_javadetector_jre17_1() {
        assert_eq!(get_jre_version("1.18"), JreVersion::Java17);
    }
    #[test]
    fn test_javadetector_jre17_2() {
        assert_eq!(get_jre_version("1.20.4"), JreVersion::Java17);
    }
    #[test]
    fn test_javadetector_jre21_1() {
        assert_eq!(get_jre_version("1.20.5"), JreVersion::Java21);
    }
    #[test]
    fn test_javadetector_jre21_2() {
        assert_eq!(get_jre_version("1.21.11"), JreVersion::Java21);
    }
    #[test]
    fn test_javadetector_jre25() {
        assert_eq!(get_jre_version("26.1"), JreVersion::Java25);
    }
}