export default {
  subsets: {
    'font-size': ['0.25em', '0.5em', '0.75em', '1em'],
  },
  '@media': [
    {
      type: 'print',
      params: {
        'max-width': ['400px'],
      },
      subsets: {
        'font-size': ['0.5em', '1em'],
      },
    },
  ],
};
