// Overwritten by deploy and by the Vite build plugin.
// Incomplete on purpose: local `vite` infers hosts from the page, and
// create-org stays false unless a hosted build writes a full config.
window.__ENVSYNC_RUNTIME_CONFIG__ = {
  deploymentMode: "selfhosted",
  canCreateOrganization: false
};
