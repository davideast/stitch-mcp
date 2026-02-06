import { type CommandStep, type StepResult } from '../../../framework/CommandStep.js';
import { type InitContext } from '../context.js';
import { detectEnvironment } from '../../../platform/environment.js';
import path from 'node:path';
import { theme } from '../../../ui/theme.js';

export class AuthStep implements CommandStep<InitContext> {
  id = 'authentication';
  name = 'Authenticate with Google';

  async shouldRun(context: InitContext): Promise<boolean> {
    return context.authMode !== 'apiKey';
  }

  async run(context: InitContext): Promise<StepResult> {
     if (context.authMode === 'apiKey') {
        return { success: true, status: 'SKIPPED', reason: 'Using API Key' };
    }

    // Detect environment for auth guidance
    const env = detectEnvironment();
    if (env.needsNoBrowser && env.reason) {
      context.ui.warn(`\n  ⚠ ${env.reason}`);
      context.ui.log('  If browser auth fails, copy the URL from terminal and open manually.\n');
    }

    // Check existing auth state
    const existingAccount = await context.gcloudService.getActiveAccount();
    const hasADC = await context.gcloudService.hasADC();

    if (existingAccount && hasADC) {
      context.authAccount = existingAccount;
      return {
          success: true,
          detail: existingAccount,
          status: 'SKIPPED',
          reason: 'Already authenticated'
      };
    }

    const gcloudInfo = await context.gcloudService.ensureInstalled({
      minVersion: '400.0.0',
      forceLocal: context.input.local
    });
    if (!gcloudInfo.success) return { success: false, error: new Error('Gcloud not found') };

    const isBundled = gcloudInfo.data.location === 'bundled';
    const gcloudBinDir = path.dirname(gcloudInfo.data.path);
    let configPrefix = '';

    if (isBundled) {
        const configPath = path.dirname(gcloudBinDir) + '/../config';
        configPrefix = `CLOUDSDK_CONFIG="${configPath}"`;

        context.ui.warn('\nConfigure gcloud PATH\n');
        context.ui.log('  Open a NEW terminal tab/window and run this command:\n');
        context.ui.log(theme.cyan(`  export PATH="${gcloudBinDir}:$PATH"\n`));

        try {
          const { default: clipboard } = await import('clipboardy');
          await clipboard.write(`export PATH="${gcloudBinDir}:$PATH"`);
          context.ui.log(theme.gray('  (copied to clipboard)'));
        } catch { /* clipboard not available */ }

        await context.ui.promptConfirm('Press Enter when complete', true);
    }

    // User auth
    if (!existingAccount) {
        context.ui.warn('\nAuthenticate with Google Cloud\n');
        context.ui.log(theme.cyan(`  ${configPrefix} gcloud auth login\n`));
        await context.ui.promptConfirm('Press Enter when complete', true);
    }

    // ADC auth
    if (!hasADC) {
        context.ui.warn('\nAuthorize Application Default Credentials\n');
        context.ui.log(theme.cyan(`  ${configPrefix} gcloud auth application-default login\n`));
        await context.ui.promptConfirm('Press Enter when complete', true);
    }

    const verifyAccount = await context.gcloudService.getActiveAccount();
    if (!verifyAccount) {
        return {
            success: false,
            error: new Error('No authenticated account found after setup'),
            detail: 'No account found',
            errorCode: 'AUTH_FAILED'
        };
    }
    context.authAccount = verifyAccount;

    return {
        success: true,
        detail: verifyAccount
    };
  }
}
