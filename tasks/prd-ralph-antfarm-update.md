# PRD: OpenSpec-Native Ralph Engine (Antfarm Update)

## Introduction
OpenSpec-Native Ralph Engine을 개선하여 **Antfarm의 멀티 에이전트 검증**, **OPSX의 유연한 워크플로우**, **Ralph TUI의 투명성**을 통합합니다. 기존의 안정성 위에 자율성과 유연성을 더하여 엔터프라이즈급 자율 코딩 엔진으로 도약합니다.

## Core Pillars
1. **Multi-Agent Verification (Antfarm)**: "자기가 짠 코드를 자기가 검증하지 않는다". Developer와 Verifier의 역할 분리.
2. **OpenSpec CLI as SSoT**: Ralph가 자체 DAG/상태 로직을 갖지 않고, `openspec status --json`과 `openspec instructions --json`을 유일한 진실의 원천으로 사용.
3. **Feedback Loop (Antfarm)**: 단순 재시도가 아닌, Verifier의 구체적인 피드백을 바탕으로 한 수정-검증 루프.
4. **Project Context (OPSX config.yaml)**: 프로젝트 tech stack, conventions, rules를 `openspec/config.yaml`에 정의하여 모든 에이전트 프롬프트에 자동 주입.

## OpenSpec OPSX 핵심 메커니즘 (Ralph가 의존하는 것들)

### Artifact 상태는 파일시스템으로 결정된다
OpenSpec에는 `block`/`unblock` 명령어가 없다. 상태는 순수하게 파일 존재 여부로 계산된다:
- **done**: `schema.yaml`의 `generates` 파일이 디스크에 존재
- **ready**: 모든 `requires` 의존성이 `done`이고, 자신의 파일은 미존재
- **blocked**: `requires` 중 하나 이상이 `done`이 아님

### Ralph가 사용할 CLI 명령어
```bash
# 1. 현재 상태 확인 (루프 제어)
openspec status --json --change <name>
# → { artifacts: [{id, status, missingDeps}], isComplete, applyRequires }

# 2. Artifact 생성을 위한 프롬프트 (Planning 단계)
openspec instructions <artifact-id> --json --change <name>
# → { instruction, template, context, rules, dependencies, unlocks }

# 3. 태스크 실행을 위한 프롬프트 (Implementation 단계)
openspec instructions apply --json --change <name>
# → { tasks: [{id, description, done}], state, progress, contextFiles }

# 4. 검증
openspec validate <name>

# 5. 아카이브
openspec archive <name>
```

### config.yaml 활용
`openspec/config.yaml`의 `context`와 `rules`는 `openspec instructions`를 호출할 때 자동으로 프롬프트에 주입된다. Ralph가 별도로 파싱할 필요 없음.

```yaml
# openspec/config.yaml
schema: spec-driven
context: |
  Tech stack: Next.js 16, React 19, Drizzle ORM, LibSQL
  Styling: Tailwind CSS v4, shadcn/ui
  Testing: bun test
  Conventions: Biome, strict TypeScript (no `any`)
rules:
  tasks:
    - Each task must be completable in one agent session
    - Include typecheck verification in every task
```

## Features & Requirements

### 1. Multi-Agent Verification (Antfarm x OpenSpec Filesystem)
**Status**: 🔴 High Priority
**Concept**: Developer 에이전트가 구현을 마치면, 독립된 세션의 Verifier 에이전트가 코드를 리뷰합니다.

**OpenSpec 활용 방식**:
- Verifier의 프롬프트는 OpenSpec 스키마에 `verification-report` artifact로 정의 가능 (커스텀 스키마).
- 단, 현재 단계에서는 Ralph 내부에서 Verifier 프롬프트를 관리해도 무방 (스키마 커스터마이징은 추후).
- Verifier 결과(pass/fail + feedback)는 `.ralph/` 디렉토리에 저장.

**Requirements**:
- Verifier는 Developer와 별도의 sandbox session에서 실행.
- Verifier는 Developer의 대화 내역을 모르고, 파일시스템 상태(코드, 테스트)만으로 판단.
- Verifier 결과는 `IterationLog`에 `verifierFeedback` 필드로 기록.

### 2. Feedback Loop (파일 기반)
**Status**: 🟠 High Priority
**Concept**: 검증 실패 시 Verifier의 피드백을 Developer에게 전달하여 수정 유도.

**Flow**:
1. Developer 구현 완료 → `tasks.md` 체크박스 업데이트.
2. Ralph Engine이 `collectVerificationEvidence()` 실행 (기존 Dual-Gate).
3. Dual-Gate 통과 후, Verifier 에이전트 실행 (새로운 단계).
   - **Pass**: 태스크 완료 처리.
   - **Fail**: Verifier 피드백을 `.ralph/verification-feedback.md`에 저장.
4. 다음 iteration에서 Developer 프롬프트에 `## PREVIOUS VERIFICATION FEEDBACK` 섹션으로 피드백 주입.
5. 최대 재시도 횟수(기본 2회) 초과 시 에스컬레이션.

**Requirements**:
- 피드백은 요약 형태로 전달 (컨텍스트 윈도우 보호).
- 재시도 시 Developer는 Fresh Session에서 시작 (피드백만 주입).

### 3. OpenSpec-Native Workflow (SSoT)
**Status**: 🟡 Medium Priority
**Concept**: Ralph Engine의 자체 DAG/태스크 로직을 제거하고, OpenSpec CLI 출력을 그대로 따름.

**현재 하드코딩된 것들 → OpenSpec CLI로 대체**:
| 현재 (하드코딩) | 대체 (OpenSpec CLI) |
|---|---|
| `getOpenSpecStatus()` → `ApplyInstructionsSchema` 자체 파싱 | `openspec instructions apply --json` 그대로 사용 |
| `validateOpenSpec()` → CLI 직접 호출 | 유지 (이미 CLI 사용 중) |
| `markTaskComplete()` → tasks.md 직접 수정 | 유지 (OpenSpec이 tasks.md 파싱, Ralph가 수정) |
| `escalateChange()` → `openspec block` 호출 | **삭제** (`openspec block` 명령어 미존재). 대신 session 상태를 `failed`로 변경 |
| `finalizeChange()` → `openspec archive` 호출 | 유지 |

**Requirements**:
- `openspec status --json` 결과의 `isComplete`, `artifacts[].status`, `applyRequires`를 루프 제어에 사용.
- `openspec instructions apply --json` 결과의 `tasks`, `state`, `instruction`을 프롬프트 생성에 사용.
- Ralph는 OpenSpec의 상태 전이 로직을 재구현하지 않음.

### 4. Project Context via config.yaml
**Status**: 🟡 Medium Priority (즉시 적용 가능)
**Concept**: `openspec/config.yaml`을 생성하여 프로젝트 컨텍스트를 모든 에이전트 프롬프트에 자동 주입.

**Requirements**:
- open-agent 프로젝트에 `openspec/config.yaml` 생성.
- `context` 필드에 tech stack, conventions 기재.
- `rules` 필드에 artifact별 규칙 기재.
- `openspec instructions` 호출 시 자동 주입되므로 Ralph 코드 변경 불필요.

### 5. Subagent Tracing (Ralph TUI)
**Status**: ⚪ Medium Priority
**Concept**: 에이전트의 도구 호출과 서브 에이전트 실행을 추적하여 로그에 기록.

**Requirements**:
- `IterationLog` 스키마에 `traces` 필드 추가.
- `sandbox-agent` 실행 시 도구 호출 입출력 캡처.
- 대시보드에서 타임라인 시각화.

### 6. Dependency-aware Task Execution (Beads)
**Status**: 🟤 Low-Medium Priority
**Concept**: 태스크 간 의존성을 분석하여 unblocked 태스크를 지능적으로 선택.

**Requirements**:
- `tasks.md`의 들여쓰기나 의존성 표기 파싱.
- 의존성 해결된 태스크만 작업 큐에 추가.

### 7. Cross-iteration Knowledge Transfer (Ralph)
**Status**: 🟢 기존 (강화)
**Concept**: `codebasePatterns`와 `recentFailures`를 누적하여 다음 iteration에 전달.

**Requirements**:
- Codebase Patterns를 progress 파일에 명시적 섹션으로 유지.
- 매 iteration 성공/실패 시 패턴 추출.

## Architecture Update

```
Ralph Engine Main Loop (Simplified)
─────────────────────────────────────
1. openspec status --json → isComplete?
   ├─ yes → openspec archive → done
   └─ no → any artifact ready?
       ├─ yes → openspec instructions <id> --json → generate artifact
       └─ no (all artifacts done) →
           openspec instructions apply --json → get next task
           ├─ state: all_done → archive
           ├─ state: blocked → wait/escalate
           └─ state: ready →
               a) Developer agent executes task
               b) Dual-Gate verification (check command)
               c) Verifier agent reviews (new!)
                  ├─ pass → mark task complete in tasks.md
                  └─ fail → save feedback → retry (max 2)
```

## Non-Goals
- OpenSpec CLI의 상태 로직을 Ralph 내부에 재구현하지 않음.
- `openspec block`/`unblock` 같은 미존재 명령어에 의존하지 않음.
- 커스텀 스키마(verification-report artifact) 구현은 첫 단계에서 제외.

## Migration Plan

1. **Step 1**: `openspec/config.yaml` 생성 (즉시 효과, 코드 변경 없음).
2. **Step 2**: `RalphEngine.run()`에서 `escalateChange()` (`openspec block` 호출) 제거, session 상태 기반으로 전환.
3. **Step 3**: Verifier 에이전트 단계 추가 (Dual-Gate 이후, 별도 sandbox session).
4. **Step 4**: 피드백 루프 구현 (`.ralph/verification-feedback.md` 기반).
5. **Step 5**: Tracing 로직 추가 및 대시보드 연동.
