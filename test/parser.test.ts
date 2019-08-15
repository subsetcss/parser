import { parser } from '../src';
import testConfig from './fixtures/config';

describe('parser', () => {
  it('returns declarations in root subset', async () => {
    let css = `
      @media (max-width: 400px) {
        .nav {
          font-size: 1em;
        }
      }

      .nav {
        font-size: 
      }
    `;
    let result = await parser(testConfig, css, 8);
    debugger;
    console.log(result);
    expect(result.config).toEqual([
      '0.25em',
      '0.5em',
      '0.75em',
      '1em'
    ]);
  });

  it('returns declarations in media subset', async () => {
    let css = `
      @media (max-width: 400px) {
        .nav {
          font-size:
        }
      }

      .nav {
        font-size: 1em;
      }
    `;
    let result = await parser(testConfig, css, 3);
    
    expect(result.config).toEqual([
      '0.5em',
      '1em'
    ]);
  });
});
