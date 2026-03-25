# dotagents Makefile
# Pi-first skills & extensions installer.
#
# Configuration lives in install.toml.
# Requires Python 3.11+.

PYTHON := python3
BUILD_SCRIPT := $(CURDIR)/scripts/build.py

.PHONY: all install install-skills install-extensions build clean help check-python

# Capture mode argument (preview, overwrite, wipe) after install commands
ifeq (install,$(firstword $(MAKECMDGOALS)))
  INSTALL_ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
  ifneq (,$(INSTALL_ARGS))
    $(eval $(INSTALL_ARGS):;@:)
  endif
endif

ifeq (install-skills,$(firstword $(MAKECMDGOALS)))
  INSTALL_ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
  ifneq (,$(INSTALL_ARGS))
    $(eval $(INSTALL_ARGS):;@:)
  endif
endif

ifeq (install-extensions,$(firstword $(MAKECMDGOALS)))
  INSTALL_ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
  ifneq (,$(INSTALL_ARGS))
    $(eval $(INSTALL_ARGS):;@:)
  endif
endif

all: help

help:
	@echo "dotagents - Pi-first skills & extensions installer"
	@echo ""
	@echo "Usage:"
	@echo "  make install [preview]              Preview what would be installed (default)"
	@echo "  make install overwrite              Install, overwriting any conflicts"
	@echo "  make install wipe                   Wipe destinations, then install"
	@echo "  make install-skills [preview]       Preview skills only"
	@echo "  make install-skills overwrite       Install skills only"
	@echo "  make install-extensions [preview]   Preview extensions only"
	@echo "  make install-extensions overwrite   Install extensions only"
	@echo "  make build                          Build to build/ without installing"
	@echo "  make clean                          Remove dotagents items from destinations"
	@echo ""
	@echo "Configuration: install.toml"

check-python:
	@$(PYTHON) -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" 2>/dev/null || \
		(echo "Error: Python 3.11+ required"; exit 1)

install: check-python
	@$(PYTHON) $(BUILD_SCRIPT) install $(INSTALL_ARGS)

install-skills: check-python
	@$(PYTHON) $(BUILD_SCRIPT) install $(INSTALL_ARGS) --only skills

install-extensions: check-python
	@$(PYTHON) $(BUILD_SCRIPT) install $(INSTALL_ARGS) --only extensions

build: check-python
	@$(PYTHON) $(BUILD_SCRIPT) build

clean: check-python
	@$(PYTHON) $(BUILD_SCRIPT) clean
