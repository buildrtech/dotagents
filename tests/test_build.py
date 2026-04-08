import importlib
import tempfile
import unittest
from pathlib import Path


class BuildSkillsTests(unittest.TestCase):
    def setUp(self):
        self.build = importlib.import_module("scripts.build")
        self.original_build_dir = self.build.BUILD_DIR
        self.original_install_paths = dict(self.build.INSTALL_PATHS)
        self.original_home = self.build.HOME
        self.original_agents_dir = self.build.AGENTS_DIR
        self.original_pi_agents_path = self.build.PI_AGENTS_PATH
        self.original_pi_extensions_path = self.build.PI_EXTENSIONS_PATH

    def tearDown(self):
        self.build.BUILD_DIR = self.original_build_dir
        self.build.INSTALL_PATHS = self.original_install_paths
        self.build.HOME = self.original_home
        self.build.AGENTS_DIR = self.original_agents_dir
        self.build.PI_AGENTS_PATH = self.original_pi_agents_path
        self.build.PI_EXTENSIONS_PATH = self.original_pi_extensions_path

    def test_install_skills_preserves_unmanaged_skills(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            built = root / "build" / "skills" / "new-skill"
            built.mkdir(parents=True)
            (built / "SKILL.md").write_text("---\nname: new-skill\n---\n")

            installed = root / "installed-skills"
            unmanaged = installed / "third-party"
            unmanaged.mkdir(parents=True)
            (unmanaged / "SKILL.md").write_text("---\nname: third-party\n---\n")

            self.build.BUILD_DIR = root / "build"
            self.build.INSTALL_PATHS = {"unified": installed}

            self.build.install_skills()

            self.assertTrue((installed / "new-skill" / "SKILL.md").exists())
            self.assertTrue((installed / "third-party" / "SKILL.md").exists())

    def test_install_skills_removes_stale_managed_skills(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            built = root / "build" / "skills" / "fresh-skill"
            built.mkdir(parents=True)
            (built / "SKILL.md").write_text("---\nname: fresh-skill\n---\n")

            installed = root / "installed-skills"
            stale = installed / "old-skill"
            stale.mkdir(parents=True)
            (stale / "SKILL.md").write_text("---\nname: old-skill\n---\n")

            unmanaged = installed / "third-party"
            unmanaged.mkdir(parents=True)
            (unmanaged / "SKILL.md").write_text("---\nname: third-party\n---\n")

            manifest = installed / ".dotagents-managed-skills"
            manifest.write_text("fresh-skill\nold-skill\n")

            self.build.BUILD_DIR = root / "build"
            self.build.INSTALL_PATHS = {"unified": installed}

            self.build.install_skills()

            self.assertFalse((installed / "old-skill").exists())
            self.assertTrue((installed / "fresh-skill" / "SKILL.md").exists())
            self.assertTrue((installed / "third-party" / "SKILL.md").exists())
            self.assertEqual(manifest.read_text(), "fresh-skill\n")

    def test_clean_removes_only_managed_skills(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            installed = root / "installed-skills"

            managed = installed / "managed-skill"
            managed.mkdir(parents=True)
            (managed / "SKILL.md").write_text("---\nname: managed-skill\n---\n")

            unmanaged = installed / "third-party"
            unmanaged.mkdir(parents=True)
            (unmanaged / "SKILL.md").write_text("---\nname: third-party\n---\n")

            manifest = installed / ".dotagents-managed-skills"
            manifest.write_text("managed-skill\n")

            self.build.INSTALL_PATHS = {"unified": installed}
            self.build.BUILD_DIR = root / "build"
            self.build.HOME = root / "home"
            self.build.AGENTS_DIR = root / "agents-source"
            self.build.PI_AGENTS_PATH = root / "pi-agents"
            self.build.PI_EXTENSIONS_PATH = root / "pi-extensions"

            self.build.clean()

            self.assertFalse((installed / "managed-skill").exists())
            self.assertTrue((installed / "third-party" / "SKILL.md").exists())
            self.assertFalse(manifest.exists())


class BuildExtensionsTests(unittest.TestCase):
    def setUp(self):
        self.build = importlib.import_module("scripts.build")
        self.original_pi_extensions_dir = getattr(self.build, "PI_EXTENSIONS_DIR", None)
        self.original_build_dir = self.build.BUILD_DIR
        self.original_pi_extensions_path = getattr(self.build, "PI_EXTENSIONS_PATH", None)

    def tearDown(self):
        if self.original_pi_extensions_dir is not None:
            self.build.PI_EXTENSIONS_DIR = self.original_pi_extensions_dir
        if self.original_pi_extensions_path is not None:
            self.build.PI_EXTENSIONS_PATH = self.original_pi_extensions_path
        self.build.BUILD_DIR = self.original_build_dir

    def test_build_extensions_copies_extension_directories(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "pi-extensions"
            ext_dir = source / "handoff"
            ext_dir.mkdir(parents=True)
            (ext_dir / "index.ts").write_text("export default function () {}\n")
            (ext_dir / "events.ts").write_text("export const value = 1\n")

            self.build.PI_EXTENSIONS_DIR = source
            self.build.BUILD_DIR = root / "build"

            self.build.build_extensions()

            self.assertTrue((self.build.BUILD_DIR / "extensions" / "handoff" / "index.ts").exists())
            self.assertTrue((self.build.BUILD_DIR / "extensions" / "handoff" / "events.ts").exists())

    def test_install_extensions_copies_built_extensions_into_pi_extensions_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            built = root / "build" / "extensions" / "session-query"
            built.mkdir(parents=True)
            (built / "index.ts").write_text("export default function () {}\n")

            self.build.BUILD_DIR = root / "build"
            self.build.PI_EXTENSIONS_PATH = root / "installed-extensions"

            self.build.install_extensions()

            self.assertTrue((self.build.PI_EXTENSIONS_PATH / "session-query" / "index.ts").exists())

    def test_install_extensions_removes_stale_managed_extensions(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            built = root / "build" / "extensions" / "session-query"
            built.mkdir(parents=True)
            (built / "index.ts").write_text("export default function () {}\n")

            installed = root / "installed-extensions"
            stale = installed / "old-ext"
            stale.mkdir(parents=True)
            (stale / "index.ts").write_text("export default function () {}\n")

            unmanaged = installed / "third-party"
            unmanaged.mkdir(parents=True)
            (unmanaged / "index.ts").write_text("export default function () {}\n")

            manifest = installed / ".dotagents-managed-extensions"
            manifest.write_text("old-ext\nsession-query\n")

            self.build.BUILD_DIR = root / "build"
            self.build.PI_EXTENSIONS_PATH = installed

            self.build.install_extensions()

            self.assertFalse((installed / "old-ext").exists())
            self.assertTrue((installed / "session-query" / "index.ts").exists())
            self.assertTrue((installed / "third-party" / "index.ts").exists())
            self.assertEqual(manifest.read_text(), "session-query\n")


if __name__ == "__main__":
    unittest.main()
