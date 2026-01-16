import chalk from 'chalk';

/**
 * Theme colors matching the shell script aesthetic
 */
export const theme = {
  blue: chalk.hex('#5E9BFF'),
  green: chalk.hex('#4EC9B0'),
  gray: chalk.hex('#646464'),
  red: chalk.hex('#E65050'),
  yellow: chalk.hex('#DCDC64'),
  cyan: chalk.hex('#4DC9FF'),
  bgDark: chalk.bgHex('#151315'),
};

export const icons = {
  success: '✔',
  error: '✖',
  info: 'ℹ',
  warning: '⚠',
};
