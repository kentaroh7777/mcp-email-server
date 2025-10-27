#!/bin/bash

# MCP Email Server 管理スクリプト
# Usage: ./scripts/server.sh {start|stop|restart|status|logs}

PLIST_FILE="$HOME/Library/LaunchAgents/com.user.mcp-email-server.plist"
SERVICE_NAME="com.user.mcp-email-server"
LOG_FILE="$HOME/Library/Logs/mcp-email-server.log"
ERROR_LOG_FILE="$HOME/Library/Logs/mcp-email-server-error.log"

# 色付きメッセージ
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ヘルプメッセージ
show_help() {
    echo "🖥️  MCP Email Server 管理スクリプト"
    echo ""
    echo "使用方法:"
    echo "  ./scripts/server.sh {start|stop|restart|status|logs|health}"
    echo ""
    echo "コマンド:"
    echo "  start    サーバーを開始"
    echo "  stop     サーバーを停止"
    echo "  restart  サーバーを再起動（認証トークン更新後に推奨）"
    echo "  status   サーバーの状態を確認"
    echo "  logs     サーバーのログを表示"
    echo "  health   ヘルスチェックを実行"
    echo "  help     このヘルプを表示"
    echo ""
    echo "例："
    echo "  ./scripts/server.sh restart  # Gmail認証後の再起動"
    echo "  ./scripts/server.sh status   # サーバー状態確認"
    echo "  ./scripts/server.sh health   # 全機能テスト"
}

# サーバーの状態を確認
check_status() {
    local pid_status=$(launchctl list | grep "$SERVICE_NAME" 2>/dev/null)
    
    if [[ -n "$pid_status" ]]; then
        local pid=$(echo "$pid_status" | awk '{print $1}')
        local exit_code=$(echo "$pid_status" | awk '{print $2}')
        
        if [[ "$pid" != "-" ]]; then
            echo -e "${GREEN}✅ サーバーは実行中です${NC}"
            echo "  PID: $pid"
            echo "  サービス名: $SERVICE_NAME"
            
            # HTTP接続テスト
            if curl -s http://localhost:3456/ping > /dev/null 2>&1; then
                echo -e "  HTTP接続: ${GREEN}✅ 正常${NC}"
            else
                echo -e "  HTTP接続: ${RED}❌ 応答なし${NC}"
            fi
            return 0
        else
            echo -e "${RED}❌ サーバーは停止しています${NC}"
            if [[ "$exit_code" != "0" ]]; then
                echo "  終了コード: $exit_code"
            fi
            return 1
        fi
    else
        echo -e "${RED}❌ サーバーは登録されていません${NC}"
        return 1
    fi
}

# サーバーを開始
start_server() {
    echo "🚀 MCP Email Server を開始しています..."
    
    if ! [ -f "$PLIST_FILE" ]; then
        echo -e "${RED}❌ plistファイルが見つかりません: $PLIST_FILE${NC}"
        return 1
    fi
    
    # 既に実行中かチェック
    if launchctl list | grep -q "$SERVICE_NAME"; then
        if check_status > /dev/null 2>&1; then
            echo -e "${YELLOW}⚠️  サーバーは既に実行中です${NC}"
            return 0
        else
            echo "既存のサービスをクリーンアップしています..."
            launchctl unload "$PLIST_FILE" 2>/dev/null
        fi
    fi
    
    # サーバーを開始
    if launchctl load "$PLIST_FILE"; then
        sleep 2
        if check_status > /dev/null 2>&1; then
            echo -e "${GREEN}✅ サーバーの開始に成功しました${NC}"
            return 0
        else
            echo -e "${RED}❌ サーバーの開始に失敗しました${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ launchctl load に失敗しました${NC}"
        return 1
    fi
}

# サーバーを停止
stop_server() {
    echo "🛑 MCP Email Server を停止しています..."
    
    if ! launchctl list | grep -q "$SERVICE_NAME"; then
        echo -e "${YELLOW}⚠️  サーバーは実行されていません${NC}"
        return 0
    fi
    
    if launchctl unload "$PLIST_FILE"; then
        echo -e "${GREEN}✅ サーバーを停止しました${NC}"
        return 0
    else
        echo -e "${RED}❌ サーバーの停止に失敗しました${NC}"
        return 1
    fi
}

# サーバーを再起動
restart_server() {
    echo "🔄 MCP Email Server を再起動しています..."
    
    # 停止
    if launchctl list | grep -q "$SERVICE_NAME"; then
        echo "サーバーを停止中..."
        stop_server
        sleep 1
    fi
    
    # 開始
    echo "サーバーを開始中..."
    if start_server; then
        echo -e "${GREEN}✅ サーバーの再起動が完了しました${NC}"
        echo ""
        echo -e "${BLUE}💡 認証トークン更新後の再起動が完了しました${NC}"
        echo "動作確認を実行することをお勧めします:"
        echo "  📋 ./scripts/server.sh health"
        return 0
    else
        echo -e "${RED}❌ サーバーの再起動に失敗しました${NC}"
        return 1
    fi
}

# ログを表示
show_logs() {
    echo "📋 MCP Email Server ログ"
    echo "========================"
    echo ""
    
    if [[ "$1" == "error" ]] || [[ "$1" == "err" ]]; then
        echo -e "${RED}エラーログ:${NC}"
        if [[ -f "$ERROR_LOG_FILE" ]]; then
            tail -50 "$ERROR_LOG_FILE"
        else
            echo "エラーログファイルが見つかりません: $ERROR_LOG_FILE"
        fi
    else
        echo -e "${BLUE}標準ログ:${NC}"
        if [[ -f "$LOG_FILE" ]]; then
            tail -50 "$LOG_FILE"
        else
            echo "ログファイルが見つかりません: $LOG_FILE"
        fi
    fi
    
    echo ""
    echo -e "${YELLOW}ログファイル場所:${NC}"
    echo "  標準ログ: $LOG_FILE"
    echo "  エラーログ: $ERROR_LOG_FILE"
    echo ""
    echo -e "${BLUE}リアルタイムログ監視:${NC}"
    echo "  tail -f \"$LOG_FILE\""
}

# ヘルスチェックを実行
run_health_check() {
    echo "🏥 ヘルスチェックを実行しています..."
    echo ""
    
    # サーバーの状態を先にチェック
    if ! check_status > /dev/null 2>&1; then
        echo -e "${RED}❌ サーバーが実行されていません。先にサーバーを開始してください。${NC}"
        echo "  📋 ./scripts/server.sh start"
        return 1
    fi
    
    # ヘルスチェック実行
    if command -v npm > /dev/null 2>&1; then
        npm run health:check
    else
        echo -e "${RED}❌ npmが見つかりません${NC}"
        return 1
    fi
}

# メイン処理
case "$1" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        check_status
        ;;
    logs)
        show_logs "$2"
        ;;
    health)
        run_health_check
        ;;
    help|--help|-h)
        show_help
        ;;
    "")
        echo -e "${YELLOW}⚠️  コマンドが指定されていません${NC}"
        echo ""
        show_help
        exit 1
        ;;
    *)
        echo -e "${RED}❌ 不明なコマンド: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac

exit $?