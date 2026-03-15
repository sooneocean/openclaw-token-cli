import { Command } from 'commander';
import { output } from '../output/formatter.js';

const BASH_COMPLETION = `# openclaw-token bash completion
# Add to ~/.bashrc: eval "$(openclaw-token completion bash)"
_openclaw_token() {
  local cur prev commands subcommands
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  commands="auth credits keys integrate profile audit completion"

  case "\${COMP_WORDS[1]}" in
    auth)
      subcommands="register login logout whoami rotate"
      ;;
    credits)
      subcommands="balance buy history auto-topup"
      ;;
    keys)
      subcommands="create list info update revoke revoke-all rotate"
      ;;
    integrate)
      subcommands=""
      ;;
    profile)
      subcommands="create switch list current delete"
      ;;
    audit)
      subcommands="show clear"
      ;;
    completion)
      subcommands="bash zsh"
      ;;
    *)
      COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
      return 0
      ;;
  esac

  if [[ \${COMP_CWORD} -eq 2 ]]; then
    COMPREPLY=( $(compgen -W "\${subcommands}" -- "\${cur}") )
  fi

  # Global flags
  if [[ "\${cur}" == -* ]]; then
    local flags="--json --mock --no-color --verbose --profile --help --version"
    COMPREPLY=( $(compgen -W "\${flags}" -- "\${cur}") )
  fi

  return 0
}
complete -F _openclaw_token openclaw-token
`;

const ZSH_COMPLETION = `#compdef openclaw-token
# openclaw-token zsh completion
# Add to ~/.zshrc: eval "$(openclaw-token completion zsh)"

_openclaw-token() {
  local -a commands subcommands global_flags

  global_flags=(
    '--json[Output in JSON format]'
    '--mock[Use mock backend]'
    '--no-color[Disable colored output]'
    '--verbose[Show debug information]'
    '--profile[Use specific profile]:profile name:'
    '--help[Show help]'
    '--version[Show version]'
  )

  commands=(
    'auth:Manage authentication'
    'credits:Manage credits'
    'keys:Manage provisioned API keys'
    'integrate:Integrate with OpenClaw'
    'profile:Manage CLI profiles'
    'audit:View audit log'
    'completion:Generate shell completion'
  )

  if (( CURRENT == 2 )); then
    _describe 'command' commands
    _arguments $global_flags
    return
  fi

  case "\${words[2]}" in
    auth)
      subcommands=(
        'register:Create a new account'
        'login:Log in'
        'logout:Log out'
        'whoami:Show current user'
        'rotate:Rotate management key'
      )
      _describe 'subcommand' subcommands
      ;;
    credits)
      subcommands=(
        'balance:Check credit balance'
        'buy:Purchase credits'
        'history:View transaction history'
        'auto-topup:Manage auto top-up'
      )
      _describe 'subcommand' subcommands
      ;;
    keys)
      subcommands=(
        'create:Create a new key'
        'list:List all keys'
        'info:Show key details'
        'update:Update key settings'
        'revoke:Revoke a key'
        'revoke-all:Revoke all active keys'
        'rotate:Rotate a key'
      )
      _describe 'subcommand' subcommands
      ;;
    profile)
      subcommands=(
        'create:Create a new profile'
        'switch:Switch to a profile'
        'list:List all profiles'
        'current:Show active profile'
        'delete:Delete a profile'
      )
      _describe 'subcommand' subcommands
      ;;
    audit)
      subcommands=(
        'show:Show audit log'
        'clear:Clear audit log'
      )
      _describe 'subcommand' subcommands
      ;;
    completion)
      subcommands=('bash:Bash completion' 'zsh:Zsh completion')
      _describe 'subcommand' subcommands
      ;;
  esac
}

_openclaw-token
`;

export function createCompletionCommand(): Command {
  const completion = new Command('completion').description('Generate shell completion script');

  completion
    .command('bash')
    .description('Output bash completion script')
    .action(() => {
      output(BASH_COMPLETION);
    });

  completion
    .command('zsh')
    .description('Output zsh completion script')
    .action(() => {
      output(ZSH_COMPLETION);
    });

  return completion;
}
