# dotagents Makefile
# Installs skills for AI coding agents
#
# Run `make install` to build and install.
# Requires Python 3.11+.

PYTHON := python3
BUILD_SCRIPT := $(CURDIR)/scripts/build.py

.PHONY: all install install-skills build clean help check-python

all: help

help:
	@echo "dotagents - Skills Installer"
	@echo ""
	@echo "Usage:"
	@echo "  make install            Build and install skills"
	@echo "  make install-skills     Install skills only"
	@echo "  make build              Build skills (without installing)"
	@echo "  make clean              Remove all installed skills and build artifacts"
	@echo "  make help               Show this help message"
	@echo ""
	@echo "Install paths:"
	@echo "  Claude Code:           ~/.claude/skills/"
	@echo "  OpenCode/Pi/Codex:     ~/.agents/skills/"

check-python:
	@$(PYTHON) -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" 2>/dev/null || \
		(echo "Error: Python 3.11+ required"; exit 1)

install: check-python
	@$(PYTHON) $(BUILD_SCRIPT) install
	@echo "All skills installed"

build: check-python
	@$(PYTHON) $(BUILD_SCRIPT) build

install-skills: check-python
	@$(PYTHON) $(BUILD_SCRIPT) install-skills

clean: check-python
	@$(PYTHON) $(BUILD_SCRIPT) clean
