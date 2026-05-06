Everything is in place. Here's the complete summary:

What was done
Files modified / created
File	Action
~/.zshrc	Modified — added OpenRouter config block, 5 cc- aliases, cc-status, ccmodel alias, ccr-start / ccr-code functions
~/.claude/settings.json	Modified — merged statusline hook into existing {"theme":"dark-daltonized"}
~/.claude-code-router/config-router.json	Created — ccr routing config (openrouter provider, 4 routing rules)
~/scripts/ccmodel.sh	Created — quick-switch script, made executable
claude-code-router@2.0.0	Installed globally via npm
Reload zsh

source ~/.zshrc
Set your API key
Open ~/.zshrc and replace YOUR_OPENROUTER_API_KEY with your real key from openrouter.ai/keys:


export ANTHROPIC_AUTH_TOKEN="sk-or-v1-..."
cc- alias quick reference
Alias	Main model	Fast model	Cost
cc-gemini (default)	google/gemini-2.5-pro	google/gemini-2.5-flash	paid
cc-claude	anthropic/claude-sonnet-4-5	anthropic/claude-haiku-4-5	paid
cc-deepseek	deepseek/deepseek-r1	deepseek/deepseek-chat	cheap
cc-llama	meta-llama/llama-3.3-70b-instruct	meta-llama/llama-3.1-8b-instruct	free
cc-free	openrouter/free	openrouter/free	free
Or use the script: ccmodel deepseek (prints export commands to source).

Using claude-code-router (ccr)
ccr runs as a local proxy on localhost:3456 and routes internally, rather than setting env vars directly:


# Option A: start proxy daemon (background), then run claude normally
ccr-start &
claude

# Option B: one command that starts proxy + Claude together
ccr-code
The ccr config lives at ~/.claude-code-router/config-router.json. It reads your key from $OPENROUTER_API_KEY, which ccr-start / ccr-code set automatically from $ANTHROPIC_AUTH_TOKEN.

Note: The direct env-var approach (cc-gemini, cc-claude, etc.) works without ccr. Use ccr only if you want per-request routing rules (e.g. long-context → different model).