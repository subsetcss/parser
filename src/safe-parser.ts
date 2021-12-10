import * as tokenizer from 'postcss/lib/tokenize';
import Comment from 'postcss/lib/comment';
import * as Parser from 'postcss/lib/parser';
// import { AtRule, Input, Root } from 'postcss';


// Mostly copied from https://github.com/postcss/postcss-safe-parser/blob/fe517597de0056d57897b541fe771b2c84b94bd4/lib/safe-parser.js
// with TS added on after
export default class SafeParser extends Parser {
  constructor(input) {
    super(input);
  }

  createTokenizer() {
    this.tokenizer = tokenizer(this.input, { ignoreErrors: true })
  }

  comment(token) {
    const node = new Comment()
    this.init(node, token[2])
    const pos =
      this.input.fromOffset(token[3]) ||
      this.input.fromOffset(this.input.css.length - 1)
    node.source.end = {
      offset: token[3],
      line: pos.line,
      column: pos.col
    }

    let text = token[1].slice(2)
    if (text.slice(-2) === '*/') text = text.slice(0, -2)

    if (/^\s*$/.test(text)) {
      node.text = ''
      node.raws.left = text
      node.raws.right = ''
    } else {
      const match = text.match(/^(\s*)([^]*\S)(\s*)$/)
      node.text = match[2]
      node.raws.left = match[1]
      node.raws.right = match[3]
    }
  }

  decl(tokens) {
    if (tokens.length > 1 && tokens.some(i => i[0] === 'word')) {
      super.decl(tokens)
    }
  }


  other(start: string) {
    let end = false;
    let type = null;
    let colon = false;
    let bracket: string | null = null;
    const brackets = [];

    const tokens = [];
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
    if (brackets.length > 0) this.unclosedBracket();

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

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  unclosedBracket() {}

  unknownWord(tokens) {
    this.spaces += tokens.map(i => i[1]).join('')
  }

  unexpectedClose() {
    this.current.raws.after += '}'
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  doubleColon() {}

  unnamedAtrule(node) {
    node.name = ''
  }

  precheckMissedSemicolon(tokens) {
    const colon = this.colon(tokens)
    if (colon === false) return

    let nextStart, prevEnd
    for (nextStart = colon - 1; nextStart >= 0; nextStart--) {
      if (tokens[nextStart][0] === 'word') break
    }
    if (nextStart === 0) return

    for (prevEnd = nextStart - 1; prevEnd >= 0; prevEnd--) {
      if (tokens[prevEnd][0] !== 'space') {
        prevEnd += 1
        break
      }
    }

    const other = tokens.slice(nextStart)
    const spaces = tokens.slice(prevEnd, nextStart)
    tokens.splice(prevEnd, tokens.length - prevEnd)
    this.spaces = spaces.map(i => i[1]).join('')

    this.decl(other)
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  checkMissedSemicolon() {}

  endFile() {
    if (this.current.nodes && this.current.nodes.length) {
      this.current.raws.semicolon = this.semicolon
    }
    this.current.raws.after = (this.current.raws.after || '') + this.spaces

    while (this.current.parent) {
      this.current = this.current.parent
      this.current.raws.after = ''
    }
  }
}

// interface Tokenizer {
//   endOfFile: () => boolean;
//   nextToken: (str?: string) => string;
//   back: (item?: string) => {};
// }
