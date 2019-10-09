import tokenizer from 'postcss/lib/tokenize';
import Comment from 'postcss/lib/comment';
import Parser from 'postcss/lib/parser';
import { AtRule, Input, Root } from 'postcss';

export default class SafeParser extends Parser {
  spaces: string | null = null;
  tokenizer!: Tokenizer;
  current!: Root;

  constructor(input: Input) {
    super(input);
  }

  createTokenizer() {
    this.tokenizer = tokenizer(this.input, { ignoreErrors: true });
  }

  comment(token: string[]) {
    let node = new Comment();
    this.init(node, token[2], token[3]);
    node.source.end = { line: token[4], column: token[5] };

    let text = token[1].slice(2);
    if (text.slice(-2) === '*/') text = text.slice(0, -2);

    if (/^\s*$/.test(text)) {
      node.text = '';
      node.raws.left = text;
      node.raws.right = '';
    } else {
      let match = text.match(/^(\s*)([^]*[^\s])(\s*)$/);
      if (match) {
        node.text = match[2];
        node.raws.left = match[1];
        node.raws.right = match[3];
      }
    }
  }

  decl(tokens: string[]) {
    if (tokens.length > 1) {
      super.decl(tokens);
    }
  }

  other(start: string) {
    let end = false;
    let type = null;
    let colon = false;
    let bracket: string | null = null;
    let brackets = [];

    let tokens = [];
    let token = start;
    while (token) {
      type = token[0];
      tokens.push(token);

      if (type === '(' || type === '[') {
        if (!bracket) bracket = token;
        brackets.push(type === '(' ? ')' : ']');
      } else if (brackets.length === 0) {
        if (type === ';') {
          if (colon) {
            this.decl(tokens);
            return;
          } else {
            break;
          }
        } else if (type === '{') {
          this.rule(tokens);
          return;
        } else if (type === '}') {
          this.tokenizer!.back(tokens.pop());
          end = true;
          break;
        } else if (type === ':') {
          colon = true;
        }
      } else if (type === brackets[brackets.length - 1]) {
        brackets.pop();
        if (brackets.length === 0) bracket = null;
      }

      token = this.tokenizer!.nextToken();
    }

    if (this.tokenizer!.endOfFile()) end = true;
    if (brackets.length > 0) this.unclosedBracket(bracket);

    if (end && colon) {
      while (tokens.length) {
        token = tokens[tokens.length - 1][0];
        if (token !== 'space' && token !== 'comment') break;
        this.tokenizer!.back(tokens.pop());
      }
      this.decl(tokens);
    } else {
      this.unknownWord(tokens);
    }
  }

  unclosedBracket(_s: string | null) {}

  unknownWord(tokens: string[]) {
    this.spaces += tokens.map(i => i[1]).join('');
  }

  unexpectedClose() {
    this.current.raws.after += '}';
  }

  doubleColon() {}

  unnamedAtrule(node: AtRule) {
    node.name = '';
  }

  precheckMissedSemicolon(tokens: string[]) {
    let colon = this.colon(tokens);
    if (colon === false) return;

    let split;
    for (split = colon - 1; split >= 0; split--) {
      if (tokens[split][0] === 'word') break;
    }
    for (split -= 1; split >= 0; split--) {
      if (tokens[split][0] !== 'space') {
        split += 1;
        break;
      }
    }
    let other = tokens.splice(split, tokens.length - split);
    this.decl(other);
  }

  checkMissedSemicolon() {}

  endFile() {
    if (this.current.nodes && this.current.nodes.length) {
      this.current.raws.semicolon = this.semicolon;
    }
    this.current.raws.after = (this.current.raws.after || '') + this.spaces;

    while (this.current.parent as unknown) {
      this.current = (this.current.parent as unknown) as Root;
      this.current.raws.after = '';
    }
  }
}

interface Tokenizer {
  endOfFile: () => boolean;
  nextToken: (str?: string) => string;
  back: (item?: string) => {};
}
