/**
 * Configured source-access constant. The GitHub remote for this workspace is
 * access-controlled. Do not present clone as a public download.
 */
export const SYNAPSE_REPOSITORY_URL = "https://github.com/fredoc20231-cmyk/SYNAPSE";

/** Public anonymous clone is not available for this research repository. */
export const SYNAPSE_REPOSITORY_PUBLIC_CLONE = false;

export const SYNAPSE_REPOSITORY_ACCESS_COPY =
  "Source access is controlled. SYNAPSE does not publish this research repository as a public download, and this portal does not provide a credentials form or a fabricated Request Access endpoint. If an administrator has already granted you repository access, clone from the configured repository URL with your existing Git credentials.";

export function repositoryCloneHint(): string {
  if (SYNAPSE_REPOSITORY_PUBLIC_CLONE) {
    return `git clone ${SYNAPSE_REPOSITORY_URL}.git`;
  }
  return `git clone ${SYNAPSE_REPOSITORY_URL}.git   # requires granted access`;
}
