---
name: buildkite-cli
description: Manage Buildkite from the terminal using the bk CLI for pipelines, builds, jobs, agents, artifacts, and organization configuration.
allowed-tools: Bash(bk:*)
---

# Buildkite CLI with `bk`

Use this skill when the user needs to work with Buildkite from the command line: configure org access, inspect pipelines, trigger builds, debug jobs, manage agents, or fetch artifacts.

## Documentation

- Buildkite CLI reference: https://buildkite.com/docs/platform/cli/reference

## Quick start

```bash
# Verify CLI is available
bk version

# Configure and select organization
bk configure add --org my-org --token <api-token>
bk use my-org
bk whoami

# Discover resources
bk pipeline list
bk build list --pipeline my-pipeline
bk job list --pipeline my-pipeline --state failed
```

## Commands

### Global discovery

```bash
bk --help
bk <command> --help
bk <command> <subcommand> --help
```

### Organization and auth

```bash
bk configure add
bk use my-org
bk whoami
bk user invite teammate@example.com
```

### Pipelines

```bash
bk init
bk pipeline list
bk pipeline view my-pipeline
bk pipeline create "My Pipeline" --description "CI pipeline" --repository "git@github.com:org/repo.git"
bk pipeline validate --file pipeline.yml
bk pipeline convert --file .github/workflows/ci.yml
bk pipeline copy my-pipeline --target my-pipeline-v2
```

### Builds

```bash
bk build list --pipeline my-pipeline
bk build view 123 --pipeline my-pipeline
bk build create --pipeline my-pipeline --branch main --commit HEAD
bk build watch 123 --pipeline my-pipeline
bk build cancel 123 --pipeline my-pipeline
bk build rebuild 123 --pipeline my-pipeline
bk build download 123 --pipeline my-pipeline
```

### Jobs and logs

```bash
bk job list --pipeline my-pipeline --state failed --since 2h
bk job log <job-id> --pipeline my-pipeline --build 123
bk job retry <job-id>
bk job unblock <job-id>
bk job cancel <job-id>
```

### Artifacts

```bash
bk artifacts list 123 --pipeline my-pipeline
bk artifacts list 123 --pipeline my-pipeline --job <job-id>
bk artifacts download <artifact-id>
```

### Agents and clusters

```bash
bk agent list
bk agent view <agent-id>
bk agent pause <agent-id> --note "maintenance" --timeout-in-minutes 30
bk agent resume <agent-id>
bk agent stop <agent-id>

bk cluster list
bk cluster view <cluster-id>
```

### API and packages

```bash
# REST / GraphQL access
bk api /pipelines/my-pipeline/builds/123
bk api --method POST /pipelines --data '{"name":"my-pipeline"}'
bk api --file query.graphql

# Package registry
bk package push my-registry --file-path my-package.tar.gz
```

## Example: Trigger and watch a build

```bash
bk build create --pipeline my-pipeline --branch main --commit HEAD
bk build list --pipeline my-pipeline --limit 1
bk build watch <build-number> --pipeline my-pipeline
```

## Example: Investigate a failed job

```bash
bk build list --pipeline my-pipeline --state failed --limit 1
bk job list --pipeline my-pipeline --state failed --limit 20
bk job log <job-id> --pipeline my-pipeline --build <build-number>
bk artifacts list <build-number> --pipeline my-pipeline --job <job-id>
```

## Output tips

Prefer machine-readable output in automation:

```bash
bk build list --pipeline my-pipeline --output json
bk whoami --output json
bk cluster list --output yaml
```

## Command categories (reference)

- `agent`
- `api`
- `artifacts`
- `build`
- `cluster`
- `configure`
- `init`
- `job`
- `package`
- `pipeline`
- `use`
- `user`
- `version`
- `whoami`
