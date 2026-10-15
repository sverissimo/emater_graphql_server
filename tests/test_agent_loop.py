import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


REPO = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("agent_loop", REPO / "scripts/agent-loop.py")
loop = importlib.util.module_from_spec(spec)
spec.loader.exec_module(loop)


class GatewayWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def prepare_inputs(self):
        for name in ("node_modules", "src/generated/prisma"):
            (self.root / name).mkdir(parents=True)

    def test_node_checks_mount_root_dependencies_and_generated_client(self):
        self.prepare_inputs()
        for command in (
            "node node_modules/typescript/bin/tsc --noEmit --incremental false",
            "node --import tsx --test src/modules/produtor/produtorValidation.test.ts",
            "npm test",
            "./node_modules/.bin/tsc --noEmit",
        ):
            with self.subTest(command=command):
                self.assertEqual(loop.check_inputs(self.root, [command]), {
                    "node_modules": self.root / "node_modules",
                    "src/generated/prisma": self.root / "src/generated/prisma",
                })

    def test_node_checks_stop_if_host_prerequisites_are_missing(self):
        with self.assertRaisesRegex(loop.Stop, "host node_modules"):
            loop.check_inputs(self.root, ["node --version"])
        (self.root / "node_modules").mkdir()
        with self.assertRaisesRegex(loop.Stop, "host src/generated/prisma"):
            loop.check_inputs(self.root, ["node --version"])

    def test_python_checks_do_not_need_node_setup(self):
        self.assertEqual(loop.check_inputs(self.root, [
            "python3 -B -m unittest discover -s tests",
        ]), {})

    def test_empty_checks_stop_before_starting(self):
        with self.assertRaisesRegex(loop.Stop, "Empty check"):
            loop.check_inputs(self.root, [" "])

    def test_host_inputs_cannot_validate_dependency_or_schema_changes(self):
        self.prepare_inputs()
        inputs = loop.check_inputs(self.root, ["node --version"])
        for name in ("package.json", "package-lock.json", "prisma/schema.prisma"):
            with self.subTest(name=name):
                with self.assertRaisesRegex(loop.Stop, "host check inputs stale"):
                    loop.guard_check_inputs([name, "src/app.ts"], inputs)
        loop.guard_check_inputs(["src/app.ts"], inputs)
        loop.guard_check_inputs(["package.json"], {})

    def test_known_consumer_roots_include_gestao_estrategica(self):
        self.assertEqual(set(loop.SIBLINGS), {
            Path("/home/apps") / name for name in
            ("pnae", "cmc", "concurso_cafe", "gestao_estrategica", "nginx")
        })

    def test_only_checks_receive_readonly_host_inputs(self):
        self.prepare_inputs()
        worktree = self.root / "worktree"
        worktree.mkdir()
        io = self.root / "io"
        io.mkdir()
        inputs = loop.check_inputs(self.root, ["node --version"])
        with patch.object(loop.shutil, "which", return_value="/usr/bin/bwrap"):
            command = loop.sandbox(worktree, io, "reviewer", ["node", "--version"],
                                   network=False, check_dependencies=inputs)
            self.assertIn("--unshare-net", command)
            for name, source in inputs.items():
                index = command.index(str(source))
                self.assertEqual(command[index - 1:index + 2],
                                 ["--ro-bind", str(source), f"/workspace/{name}"])
                self.assertGreater(index - 1, command.index("/workspace"))
                self.assertTrue((worktree / name).is_dir())
            for role in ("implementer", "reviewer"):
                agent = loop.sandbox(worktree, io, role, ["provider"])
                for source in inputs.values():
                    self.assertNotIn(str(source), agent)

    def test_manual_routines_are_protected_and_mounted_readonly(self):
        names = ["docs/routines/review-and-tweak.md",
                 "docs/routines/review-and-tweak-but-dont-commit.md"]
        for name in names:
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("# Manual routine\n")
            self.assertTrue(loop.protected(name))
            with self.assertRaisesRegex(loop.Stop, "Protected path changed"):
                loop.validate_paths(self.root, [name], changes=True)
        io = self.root / "io"
        io.mkdir()
        with patch.object(loop.shutil, "which", return_value="/usr/bin/bwrap"):
            command = loop.sandbox(self.root, io, "implementer", ["provider"])
        for name in names:
            index = command.index(str(self.root / name))
            self.assertEqual(command[index - 1:index + 2],
                             ["--ro-bind", str(self.root / name), f"/workspace/{name}"])
            self.assertGreater(index - 1, command.index("/workspace"))

    def test_checks_get_private_scratch_instead_of_agent_reports(self):
        reports = self.root / "reports"
        folder = reports / "round-1-implementer"
        folder.mkdir(parents=True)
        original = folder / "input.json"
        original.write_text("report-canary")
        for failure in (False, True):
            with self.subTest(failure=failure):
                scratch = []

                def sandbox(worktree, io, role, command, **kwargs):
                    scratch.append(io)
                    self.assertFalse(io.is_relative_to(reports))
                    self.assertEqual(list(io.iterdir()), [])
                    self.assertEqual(role, "reviewer")
                    self.assertFalse(kwargs["network"])
                    self.assertNotIn("siblings", kwargs)
                    (io / "input.json").write_text("attempted-overwrite")
                    return ["sandboxed-check"]

                def execute(command, worktree, **kwargs):
                    self.assertEqual(kwargs["output"], reports / "check-1-1.txt")
                    if failure:
                        raise loop.Stop("fixture failure")

                with patch.object(loop.shutil, "which", return_value="/usr/bin/python3"), \
                        patch.object(loop, "sandbox", side_effect=sandbox), \
                        patch.object(loop, "execute", side_effect=execute):
                    if failure:
                        with self.assertRaisesRegex(loop.Stop, "fixture failure"):
                            loop.run_check(self.root, reports, 1, 1, ["python3"], {}, 1)
                    else:
                        loop.run_check(self.root, reports, 1, 1, ["python3"], {}, 1)
                self.assertEqual(original.read_text(), "report-canary")
                self.assertFalse(scratch[0].exists())

    def test_env_example_allows_repo_comments_and_empty_values(self):
        example = self.root / ".env.example"
        example.write_text('# Configuration\nDATABASE_URL=\nSERVICE_TOKEN=""\n')
        loop.validate_paths(self.root, [".env.example"])
        example.write_text("DATABASE_URL=nonempty-fixture\n")
        with self.assertRaisesRegex(loop.Stop, "empty placeholders"):
            loop.validate_paths(self.root, [".env.example"])

    def test_actual_repo_env_example_is_accepted(self):
        loop.validate_paths(REPO, [".env.example"])

    def test_changed_docs_are_checked_without_rechecking_historical_links(self):
        (self.root / "old.md").write_text("[Consumer](../sibling/missing.md)\n")
        (self.root / "new.md").write_text("[Target](target.md#existing-heading)\n")
        (self.root / "target.md").write_text("# Existing heading\n")
        with patch.object(loop, "changed_paths", return_value=["new.md"]), \
                patch.object(loop, "git") as git:
            loop.doc_checks(self.root)
            git.assert_called_once_with(self.root, "diff", "--check", "HEAD")

    def test_changed_docs_still_reject_broken_links_anchors_and_fences(self):
        (self.root / "target.md").write_text("# Existing heading\n")
        for content, error in (
            ("[Missing](missing.md)\n", "Missing or external local link"),
            ("[External](../sibling.md)\n", "Missing or external local link"),
            ("[Anchor](target.md#absent)\n", "Missing anchor"),
            ("```sh\nunfinished\n", "Unclosed code fence"),
        ):
            with self.subTest(content=content):
                (self.root / "new.md").write_text(content)
                with patch.object(loop, "changed_paths", return_value=["new.md"]):
                    with self.assertRaisesRegex(loop.Stop, error):
                        loop.doc_checks(self.root)

    def test_deleting_linked_document_is_rejected(self):
        (self.root / "guide.md").write_text("[Questions](open-questions.md)\n")
        with patch.object(loop, "changed_paths", return_value=["open-questions.md"]), \
                patch.object(loop, "files", return_value=["guide.md"]):
            with self.assertRaisesRegex(loop.Stop, "Missing or external local link"):
                loop.doc_checks(self.root)

    def test_deleting_unlinked_document_does_not_validate_old_broken_links(self):
        (self.root / "guide.md").write_text("[Old missing link](old-missing.md)\n```\n")
        with patch.object(loop, "changed_paths", return_value=["unlinked.md"]), \
                patch.object(loop, "files", return_value=["guide.md"]), \
                patch.object(loop, "git"):
            loop.doc_checks(self.root)

    def test_context_omits_duplicate_instructions_skills_and_diagrams(self):
        (self.root / "AGENTS.md").write_text("# Canonical rules\n")
        (self.root / ".claude/agents").mkdir(parents=True)
        (self.root / ".claude/CLAUDE.md").symlink_to("../AGENTS.md")
        (self.root / ".claude/agents/commit.md").write_text("Forbidden Git instructions")
        (self.root / ".claude/skills/commit-staged").mkdir(parents=True)
        (self.root / ".claude/skills/commit-staged/SKILL.md").write_text("Stage files")
        (self.root / ".claude/skills/commit-staged/AGENTS.md").write_text("Skill-only rules")
        (self.root / "docs/routines").mkdir(parents=True)
        (self.root / "docs/diagram.drawio").write_text("<xml>Large diagram</xml>")
        (self.root / "docs/routines/review-and-tweak.md").write_text("# Manual only\n")
        (self.root / "source.ts").write_text("export const fixture = true;\n")
        names = [str(path.relative_to(self.root)) for path in self.root.rglob("*")
                 if path.is_file()]
        with patch.object(loop, "files", return_value=names):
            for agent in ("codex", "claude"):
                with self.subTest(agent=agent):
                    result = loop.context(self.root, agent)
                    self.assertEqual(set(result), {
                        "AGENTS.md", "docs/routines/review-and-tweak.md", "source.ts",
                    })
                    self.assertEqual(result["AGENTS.md"], "# Canonical rules\n")
                    self.assertEqual(result["docs/routines/review-and-tweak.md"],
                                     "# Manual only\n")

    def test_adapted_workflow_docs_have_valid_local_links(self):
        names = ["docs/agent-workflow.md", "docs/open-questions.md",
                 "docs/routines/review-and-tweak.md",
                 "docs/routines/review-and-tweak-but-dont-commit.md"]
        with patch.object(loop, "changed_paths", return_value=names), \
                patch.object(loop, "git"):
            loop.doc_checks(REPO)


if __name__ == "__main__":
    unittest.main()
