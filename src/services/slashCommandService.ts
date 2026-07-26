import { SlashCommand, SubCommand, BUILTIN_SLASH_COMMANDS } from '../types/slashCommands';
import { StorageService } from './storage';

export interface ParsedSlashCommand {
  hasSlashCommand: boolean;
  commandName: string | null;
  subCommandName: string | null;
  userPrompt: string;
  matchedCommand: SlashCommand | null;
  matchedSubCommand: SubCommand | null;
  injectedInstruction: string | null;
  commandTag: string | null;
}

export class SlashCommandService {
  /**
   * Returns all commands combining built-in and user custom commands.
   */
  static getAllCommands(): SlashCommand[] {
    const customCmds = StorageService.getCustomSlashCommands();
    // Custom commands override built-ins if names match
    const customNames = new Set(customCmds.map(c => c.name.toLowerCase()));
    const filteredBuiltins = BUILTIN_SLASH_COMMANDS.filter(b => !customNames.has(b.name.toLowerCase()));
    return [...filteredBuiltins, ...customCmds];
  }

  /**
   * Parses user input starting with '/' according to syntax:
   * /[main_command] [sub_command?] [free_text_prompt]
   */
  static parseInput(input: string): ParsedSlashCommand {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) {
      return {
        hasSlashCommand: false,
        commandName: null,
        subCommandName: null,
        userPrompt: input,
        matchedCommand: null,
        matchedSubCommand: null,
        injectedInstruction: null,
        commandTag: null
      };
    }

    // Split tokens by space
    const tokens = trimmed.slice(1).split(/\s+/);
    const rawCmdName = (tokens[0] || '').toLowerCase();
    
    if (!rawCmdName) {
      return {
        hasSlashCommand: true,
        commandName: '',
        subCommandName: null,
        userPrompt: '',
        matchedCommand: null,
        matchedSubCommand: null,
        injectedInstruction: null,
        commandTag: null
      };
    }

    const allCmds = this.getAllCommands();
    const matchedCmd = allCmds.find(c => c.name.toLowerCase() === rawCmdName);

    if (!matchedCmd) {
      return {
        hasSlashCommand: true,
        commandName: rawCmdName,
        subCommandName: null,
        userPrompt: tokens.slice(1).join(' '),
        matchedCommand: null,
        matchedSubCommand: null,
        injectedInstruction: null,
        commandTag: `/${rawCmdName}`
      };
    }

    let matchedSub: SubCommand | null = null;
    let userPrompt = '';
    const possibleSubName = (tokens[1] || '').toLowerCase();

    if (matchedCmd.subCommands && possibleSubName) {
      const subMatch = matchedCmd.subCommands.find(s => s.name.toLowerCase() === possibleSubName);
      if (subMatch) {
        matchedSub = subMatch;
        userPrompt = tokens.slice(2).join(' ');
      } else {
        userPrompt = tokens.slice(1).join(' ');
      }
    } else {
      userPrompt = tokens.slice(1).join(' ');
    }

    // Build injected prompt instruction
    let injectedInstruction = matchedCmd.injectedPrompt;
    if (matchedSub && matchedSub.injectedPrompt) {
      injectedInstruction += ` Sub-task context: ${matchedSub.injectedPrompt}`;
    }

    const commandTag = matchedSub 
      ? `/${matchedCmd.name} ${matchedSub.name}`
      : `/${matchedCmd.name}`;

    return {
      hasSlashCommand: true,
      commandName: matchedCmd.name,
      subCommandName: matchedSub ? matchedSub.name : null,
      userPrompt,
      matchedCommand: matchedCmd,
      matchedSubCommand: matchedSub,
      injectedInstruction,
      commandTag
    };
  }

  /**
   * Formats prompt for AI model with injected explicit intent context.
   */
  static preparePromptForAI(input: string): { finalPrompt: string; commandTag: string | null } {
    const parsed = this.parseInput(input);
    if (!parsed.hasSlashCommand || !parsed.injectedInstruction) {
      return { finalPrompt: input, commandTag: null };
    }

    const promptBody = parsed.userPrompt ? parsed.userPrompt : '(Execute command defaults)';
    const finalPrompt = `[COMMAND DIRECTIVE: ${parsed.commandTag}]\n${parsed.injectedInstruction}\n\n[USER REQUEST]: ${promptBody}`;

    return {
      finalPrompt,
      commandTag: parsed.commandTag
    };
  }
}
