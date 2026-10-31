/**
 * Device-Isolated Client Identity Manager
 * Generates and persists a unique client device ID in localStorage.
 * Ensures user-uploaded SAR scans are scoped strictly to the uploading device/phone
 * and never leaked to other users or devices across the network.
 */

export function getClientId() {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('sagar_netra_client_id');
  if (!id) {
    id = 'client_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem('sagar_netra_client_id', id);
  }
  return id;
}
