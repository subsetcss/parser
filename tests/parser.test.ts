import { parser } from '../src';
import testConfig from './fixtures/config';

describe('parser', () => {
  it('returns declarations in root subset', async () => {
    const css = `
      @media (max-width: 400px) {
        .nav {
          font-size: 1em;
        }
      }

      .nav {
        font-size: 
      }
    `;
    const result = await parser(testConfig, css, 8);

    expect(result.config).toEqual(['0.25em', '0.5em', '0.75em', '1em']);
  });

  it('returns declarations in media subset', async () => {
    const css = `
      @media print (max-width: 400px) {
        .nav {
          font-size:
        }
      }

      .nav {
        font-size: 1em;
      }
    `;
    debugger;
    const result = await parser(testConfig, css, 3);

    expect(result.config).toEqual(['0.5em', '1em']);
  });

  it('returns declarations for properties that had longhand versions', async () => {
    const css = `
      .nav {
        margin: 
      }
    `;
    const result = await parser(
      {
        subsets: {
          'margin-right': ['1em'],
          'margin-left': ['0.5rem'],
        },
      },
      css,
      2
    );

    expect(result.config).toEqual(['1em', '0.5rem']);
  });

  it('returns declarations for properties that had longhand versions with multiple values', async () => {
    const css = `
      .nav {
        margin: 1em 0.5em 1px
      }
    `;
    const result = await parser(
      {
        subsets: {
          margin: ['1em', '0.5em'],
        },
      },
      css,
      2
    );

    expect(result.config).toEqual(['1em', '0.5em']);
  });

  it('returns declarations for properties that had shorthand versions', async () => {
    const css = `
      .nav {
        margin-right: 
      }
    `;
    const result = await parser(
      {
        subsets: {
          margin: ['1em'],
        },
      },
      css,
      2
    );

    expect(result.config).toEqual(['1em']);
  });
});
