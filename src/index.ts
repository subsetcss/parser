import postcss from 'postcss';
import safeParser from 'postcss-safe-parser';
import valueParser from 'postcss-value-parser';

const shorthandMap: ShorthandMap = {
  border: ['border-width', 'border-style', 'border-color'],
  margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  background: [],
};
const shorthandKeys = Object.keys(shorthandMap);
const findShorthand = (prop: string) => {
  return shorthandKeys.find(key => {
    let longHands = shorthandMap[key];
    return longHands && longHands.includes(prop);
  });
};

export async function parser(
  subsetConfig: SubsetConfig,
  css: string,
  lineNumber: number
): Promise<ParserResult> {
  let parsed: postcss.Root = safeParser(css);

  let result: ParserResult = await new Promise(resolve => {
    let found = false;

    parsed.walkRules((node: postcss.Rule) => {
      if (!node.source) {
        return;
      }

      let startLine = node.source.start && node.source.start.line;
      let endLine = node.source.end && node.source.end.line;

      if (!startLine || !endLine) {
        return;
      }

      if (lineNumber >= startLine && lineNumber <= endLine) {
        node.walkDecls((decl: postcss.Declaration) => {
          if (
            !decl.source ||
            !decl.source.start ||
            decl.source.start.line !== lineNumber + 1
          ) {
            return;
          }

          let rootConfig = getSubsetConfig(subsetConfig, decl);
          let config = rootConfig ? rootConfig.subsets[decl.prop] : [];

          if (!config || !config.length) {
            config = config || [];
            let alternates = shorthandMap[decl.prop];

            if (alternates) {
              alternates.forEach(alt => {
                let altConfig = rootConfig
                  ? rootConfig.subsets[alt]
                  : undefined;

                if (altConfig) {
                  config = [...config, ...altConfig];
                }
              });
            } else {
              let shorthand = findShorthand(decl.prop);
              let shorthandConfig =
                rootConfig && shorthand
                  ? rootConfig.subsets[shorthand]
                  : undefined;

              if (shorthandConfig) {
                config = [...config, ...shorthandConfig];
              }
            }
          }

          if (config) {
            found = true;
            resolve({
              config,
              decl,
            });
          }
        });
      }
    });

    if (!found) {
      resolve({
        config: [],
      });
    }
  });

  return result;
}

function getSubsetConfig(
  subsetConfig: SubsetConfig,
  decl: postcss.Declaration
) {
  let grandParent = decl.parent.parent;
  if (!grandParent || grandParent.type !== 'atrule') {
    return subsetConfig;
  }
  let inAtRule = grandParent && grandParent.type === 'atrule';
  let rootConfig =
    grandParent && inAtRule
      ? subsetConfig[`@${grandParent.name}`]
      : subsetConfig;

  if (!Array.isArray(rootConfig)) {
    return subsetConfig;
  }

  let { nodes } = valueParser(grandParent.params);

  if (nodes.length) {
    let words: string[] = [];
    nodes[0].nodes.forEach((node: ValueParserNode) => {
      if (node.type === 'word') {
        words.push(node.value);
      }
    });

    if (words.length === 2) {
      let [prop, value] = words;

      let config = rootConfig.find(conf => {
        let param = conf.params[prop];

        return param && param.includes(value);
      });

      return config || subsetConfig;
    }
  }
}

export interface ParserResult {
  config: string[];
  decl?: postcss.Declaration;
}

export interface SubsetConfig {
  subsets: Subsets;
  ['@media']?: AtMediaConfig[];
  [key: string]: any;
}

export interface Subsets {
  [key: string]: string[];
}

export interface AtMediaConfig {
  params?: {
    'max-width'?: string[];
  };
  subsets: Subsets;
}

interface ValueParserNode {
  type: string;
  value: string;
}

interface ShorthandMap {
  [type: string]: string[];
}
