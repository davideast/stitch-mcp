import chalk from 'chalk';

export const theme = {
  primary: chalk.blue || ((s: any) => s),
  secondary: chalk.cyan || ((s: any) => s),
  success: chalk.green || ((s: any) => s),
  error: chalk.red || ((s: any) => s),
  warning: chalk.yellow || ((s: any) => s),
  gray: chalk.gray || ((s: any) => s),
  bold: chalk.bold || ((s: any) => s),
};
