#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_ORIGIN="${APP_ORIGIN:-http://127.0.0.1:${APP_PORT:-3007}}"
API_ORIGIN="${API_ORIGIN:-http://127.0.0.1:${API_APP_PORT:-3009}}"
WEB_ORIGIN="${WEB_ORIGIN:-http://127.0.0.1:${WEB_APP_PORT:-3008}}"

RUN_BUILD_CHECKS=true
RUN_HTTP_CHECKS=true
FAILURES=0
WARNINGS=0
ONLY_GROUP="all"

PASS_ITEMS=()
WARN_ITEMS=()
FAIL_ITEMS=()

print_usage() {
  echo "用法: scripts/check-critical-path.sh [--skip-build] [--skip-http] [--only env|build|http]"
}

for arg in "$@"; do
  case "$arg" in
    --skip-build)
      RUN_BUILD_CHECKS=false
      ;;
    --skip-http)
      RUN_HTTP_CHECKS=false
      ;;
    --only=env)
      ONLY_GROUP="env"
      RUN_BUILD_CHECKS=false
      RUN_HTTP_CHECKS=false
      ;;
    --only=build)
      ONLY_GROUP="build"
      RUN_BUILD_CHECKS=true
      RUN_HTTP_CHECKS=false
      ;;
    --only=http)
      ONLY_GROUP="http"
      RUN_BUILD_CHECKS=false
      RUN_HTTP_CHECKS=true
      ;;
    --help|-h)
      print_usage
      exit 0
      ;;
    *)
      echo "未知参数: $arg"
      print_usage
      exit 2
      ;;
  esac
done

pass() {
  echo "[PASS] $1"
  PASS_ITEMS+=("$1")
}

warn() {
  echo "[WARN] $1"
  WARNINGS=$((WARNINGS + 1))
  WARN_ITEMS+=("$1")
}

fail() {
  echo "[FAIL] $1"
  FAILURES=$((FAILURES + 1))
  FAIL_ITEMS+=("$1")
}

section() {
  echo
  echo "== $1 =="
}

run_check() {
  local description="$1"
  shift

  if "$@"; then
    pass "$description"
  else
    fail "$description"
  fi
}

check_file_exists() {
  local file_path="$1"
  [[ -f "$file_path" ]]
}

check_env_var_in_file() {
  local file_path="$1"
  local var_name="$2"

  [[ -f "$file_path" ]] && grep -Eq "^${var_name}=" "$file_path"
}

check_command() {
  command -v "$1" >/dev/null 2>&1
}

check_json_field() {
  local json="$1"
  local expression="$2"
  JSON_INPUT="$json" JSON_EXPRESSION="$expression" node <<'EOF'
const input = process.env.JSON_INPUT;
const expression = process.env.JSON_EXPRESSION;

if (!input || !expression) {
  process.exit(1);
}

const payload = JSON.parse(input);
const result = Function("payload", `return (${expression});`)(payload);
process.exit(result ? 0 : 1);
EOF
}

fetch_url() {
  curl -fsS --max-time 10 "$1"
}

section "执行配置"
echo "ROOT_DIR: $ROOT_DIR"
echo "ONLY_GROUP: $ONLY_GROUP"
echo "RUN_BUILD_CHECKS: $RUN_BUILD_CHECKS"
echo "RUN_HTTP_CHECKS: $RUN_HTTP_CHECKS"
echo "APP_ORIGIN: $APP_ORIGIN"
echo "API_ORIGIN: $API_ORIGIN"
echo "WEB_ORIGIN: $WEB_ORIGIN"

section "基础环境"
run_check "存在根 .env 文件" check_file_exists "$ROOT_DIR/.env"
run_check "已安装 node" check_command node
run_check "已安装 npm" check_command npm
run_check "已安装 curl" check_command curl

section "关键环境变量"
for required_var in DATABASE_URL JWT_SECRET ACCOUNT_SECRET_KEY; do
  run_check ".env 包含 ${required_var}" check_env_var_in_file "$ROOT_DIR/.env" "$required_var"
done

if check_file_exists "$ROOT_DIR/apps/web/.env.local"; then
  run_check "apps/web/.env.local 包含 BACKEND_ORIGIN" check_env_var_in_file "$ROOT_DIR/apps/web/.env.local" "BACKEND_ORIGIN"
else
  warn "未发现 apps/web/.env.local，将使用 apps/web 默认 BACKEND_ORIGIN"
fi

if check_file_exists "$ROOT_DIR/apps/api/.env.local"; then
  run_check "apps/api/.env.local 包含 LEGACY_BACKEND_ORIGIN" check_env_var_in_file "$ROOT_DIR/apps/api/.env.local" "LEGACY_BACKEND_ORIGIN"
else
  warn "未发现 apps/api/.env.local，将使用 apps/api 默认 LEGACY_BACKEND_ORIGIN"
fi

if [[ "$RUN_BUILD_CHECKS" == true ]]; then
  section "静态校验"

  if (cd "$ROOT_DIR" && npm run lint >/tmp/weibo-ops-check-lint.log 2>&1); then
    pass "npm run lint"
  else
    fail "npm run lint（详见 /tmp/weibo-ops-check-lint.log）"
  fi

  if (cd "$ROOT_DIR" && npm run build >/tmp/weibo-ops-check-build-root.log 2>&1); then
    pass "npm run build"
  else
    fail "npm run build（详见 /tmp/weibo-ops-check-build-root.log）"
  fi

  if (cd "$ROOT_DIR" && npm --prefix apps/api run build >/tmp/weibo-ops-check-build-api.log 2>&1); then
    pass "npm --prefix apps/api run build"
  else
    fail "npm --prefix apps/api run build（详见 /tmp/weibo-ops-check-build-api.log）"
  fi

  if (cd "$ROOT_DIR" && npm --prefix apps/web run build >/tmp/weibo-ops-check-build-web.log 2>&1); then
    pass "npm --prefix apps/web run build"
  else
    fail "npm --prefix apps/web run build（详见 /tmp/weibo-ops-check-build-web.log）"
  fi
fi

if [[ "$RUN_HTTP_CHECKS" == true ]]; then
  section "HTTP 健康检查"

  if app_health_json="$(fetch_url "$APP_ORIGIN/api/health")"; then
    if check_json_field "$app_health_json" 'payload.ok === true'; then
      pass "app 健康接口 $APP_ORIGIN/api/health"
    else
      fail "app 健康接口返回结构异常"
    fi
  else
    fail "无法访问 app 健康接口 $APP_ORIGIN/api/health"
  fi

  if api_health_json="$(fetch_url "$API_ORIGIN/health")"; then
    if check_json_field "$api_health_json" 'payload.success === true && payload.status === "ok"'; then
      pass "api 健康接口 $API_ORIGIN/health"
    else
      fail "api 健康接口返回结构异常"
    fi
  else
    fail "无法访问 api 健康接口 $API_ORIGIN/health"
  fi

  if api_descriptor_json="$(fetch_url "$API_ORIGIN/api")"; then
    if check_json_field "$api_descriptor_json" 'payload.success === true && payload.data?.runtime === "hono" && payload.data?.nextRoutesActive === false'; then
      pass "apps/api 运行时仍为 Hono proxy-first"
    else
      fail "apps/api /api 描述与预期不一致"
    fi
  else
    fail "无法访问 api 描述接口 $API_ORIGIN/api"
  fi

  if web_home_html="$(fetch_url "$WEB_ORIGIN/login")"; then
    if [[ -n "$web_home_html" ]]; then
      pass "web 登录页 $WEB_ORIGIN/login"
    else
      fail "web 登录页返回为空"
    fi
  else
    fail "无法访问 web 登录页 $WEB_ORIGIN/login"
  fi

  if web_api_json="$(fetch_url "$WEB_ORIGIN/api")"; then
    if check_json_field "$web_api_json" 'payload.success === true'; then
      pass "web -> backend /api 链路可达"

      if check_json_field "$web_api_json" 'payload.data?.runtime === "hono" && payload.data?.nextRoutesActive === false'; then
        pass "web 当前通过 apps/api 命中 Hono proxy-first 链路"
      else
        warn "web /api 可达，但返回结果不像 apps/api Hono 描述；请检查 BACKEND_ORIGIN 当前指向"
      fi
    else
      fail "web /api 返回结构异常"
    fi
  else
    fail "无法访问 web -> /api 链路 $WEB_ORIGIN/api"
  fi
fi

section "结果汇总"
echo "FAIL: $FAILURES"
echo "WARN: $WARNINGS"
echo "PASS: ${#PASS_ITEMS[@]}"

if [[ ${#FAIL_ITEMS[@]} -gt 0 ]]; then
  echo
  echo "失败项："
  for item in "${FAIL_ITEMS[@]}"; do
    echo "- $item"
  done
fi

if [[ ${#WARN_ITEMS[@]} -gt 0 ]]; then
  echo
  echo "警告项："
  for item in "${WARN_ITEMS[@]}"; do
    echo "- $item"
  done
fi

if [[ "$FAILURES" -gt 0 ]]; then
  echo "关键路径自检失败，请按上面的 FAIL 项逐条排查。"
  exit 1
fi

if [[ "$WARNINGS" -gt 0 ]]; then
  echo "关键路径自检通过，但存在 WARN 项，建议继续确认环境是否符合预期。"
  exit 0
fi

echo "关键路径自检全部通过。"
