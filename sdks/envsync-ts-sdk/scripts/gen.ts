import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';

const BASE_URL = 'http://localhost:8600';

const generateSDK = () => {
  try {
    execSync('rm -rf src', { stdio: 'inherit' });
    execSync(`openapi -i ${BASE_URL}/openapi -o src -c fetch --name EnvSyncAPISDK`, { stdio: 'inherit' });
    console.log('SDK generated successfully.');

    // update package.json's version
    const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
    packageJson.version = '0.0.0';

    // get latest version
    const versionApi = `${BASE_URL}/version`;
    const response = execSync(`curl -s ${versionApi}`, { encoding: 'utf-8' });
    const versionData = JSON.parse(response);
    packageJson.version = versionData.version;
    writeFileSync('package.json', JSON.stringify(packageJson, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error generating SDK:', error);
  }
};

generateSDK();