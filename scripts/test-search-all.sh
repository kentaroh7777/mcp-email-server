#!/bin/bash

# search_all_emails専用テストスクリプト

echo "🔍 search_all_emails テスト開始..."
echo ""

# テストケース1: ALL accounts
echo "📧 テスト1: 全アカウント検索 (accounts: ALL)"
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "search_all_emails", "arguments": {"query": "test", "limit": 1, "accounts": "ALL"}}}' | \
timeout 30s npx tsx src/index.ts

if [ $? -eq 0 ]; then
    echo "✅ ALL accounts テスト成功"
else
    echo "❌ ALL accounts テスト失敗 (タイムアウトまたはエラー)"
fi
echo ""

# テスト2: Gmail only
echo "📧 テスト2: Gmail専用検索 (accounts: GMAIL_ONLY)"
echo '{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "search_all_emails", "arguments": {"query": "test", "limit": 1, "accounts": "GMAIL_ONLY"}}}' | \
timeout 15s npx tsx src/index.ts

if [ $? -eq 0 ]; then
    echo "✅ GMAIL_ONLY テスト成功"
else
    echo "❌ GMAIL_ONLY テスト失敗"
fi
echo ""

# テスト3: IMAP only
echo "📧 テスト3: IMAP専用検索 (accounts: IMAP_ONLY)"
echo '{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "search_all_emails", "arguments": {"query": "test", "limit": 1, "accounts": "IMAP_ONLY"}}}' | \
timeout 15s npx tsx src/index.ts

if [ $? -eq 0 ]; then
    echo "✅ IMAP_ONLY テスト成功"
else
    echo "❌ IMAP_ONLY テスト失敗"
fi
echo ""

# パフォーマンステスト
echo "⚡ パフォーマンステスト: 実行時間測定"
echo ""

echo "🕐 ALL accounts 実行時間:"
time (echo '{"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "search_all_emails", "arguments": {"query": "test", "limit": 1, "accounts": "ALL"}}}' | timeout 30s npx tsx src/index.ts > /dev/null)

echo ""
echo "🕐 GMAIL_ONLY 実行時間:"
time (echo '{"jsonrpc": "2.0", "id": 5, "method": "tools/call", "params": {"name": "search_all_emails", "arguments": {"query": "test", "limit": 1, "accounts": "GMAIL_ONLY"}}}' | timeout 15s npx tsx src/index.ts > /dev/null)

echo ""
echo "🕐 IMAP_ONLY 実行時間:"
time (echo '{"jsonrpc": "2.0", "id": 6, "method": "tools/call", "params": {"name": "search_all_emails", "arguments": {"query": "test", "limit": 1, "accounts": "IMAP_ONLY"}}}' | timeout 15s npx tsx src/index.ts > /dev/null)

echo ""
echo "🎯 search_all_emails テスト完了"