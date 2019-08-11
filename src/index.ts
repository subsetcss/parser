import postcss from 'postcss';
import valueParser from 'postcss-value-parser';


export async function parser(subsetConfig: SubsetConfig, css: string, lineNumber: number): Promise<ParserResult> {
  let parsed = postcss.parse(css);

  let result: ParserResult = await new Promise((resolve) => {
    parsed.walkRules((node) => {
      if (!node.source) {
        return;
      }

      let startLine = node.source.start && node.source.start.line;
      let endLine = node.source.end && node.source.end.line;

      if (!startLine || !endLine) {
        return;
      }

      if (lineNumber >= startLine && lineNumber <= endLine) {
        node.walkDecls(decl => {
          if (!decl.source || !decl.source.start || decl.source.start.line !== lineNumber + 1) {
            return;
          }
          let rootConfig = getSubsetConfig(subsetConfig, decl);
          let config = rootConfig ? rootConfig.subsets[decl.prop] : [];

          if (config) {
            resolve({
              config,
              decl
            });
          }
        });
      }
      resolve({
        config: []
      });
    });
  });

  return result;
}

function getSubsetConfig(subsetConfig: SubsetConfig, decl: postcss.Declaration) {
	let grandParent = decl.parent.parent;
	if (!grandParent || grandParent.type !== 'atrule') {
		return subsetConfig;
	}
	let inAtRule = grandParent && grandParent.type === 'atrule';
	let rootConfig = grandParent && inAtRule ? subsetConfig[`@${grandParent.name}`] : subsetConfig;

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
  config: string[],
  decl?: postcss.Declaration
}

export interface SubsetConfig {
	subsets: Subsets,
	['@media']?: AtMediaConfig[]
	[key: string]: any;
}

export interface Subsets {
	[key: string]: string[]
}

export interface AtMediaConfig {
	params?: {
		'max-width'?: string[]
	}
	subsets: Subsets;
}

interface ValueParserNode {
  type: string;
  value: string;
}