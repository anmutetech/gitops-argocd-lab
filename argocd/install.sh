#!/usr/bin/env bash
#
# install.sh — Install ArgoCD on an EKS cluster using Helm
#
# Usage:
#   chmod +x argocd/install.sh
#   ./argocd/install.sh
#
# Prerequisites:
#   - kubectl configured and pointing at your EKS cluster
#   - Helm 3 installed
#

set -euo pipefail

echo "============================================"
echo "  ArgoCD Installation Script"
echo "============================================"
echo ""

# -----------------------------------------------
# 1. Add the ArgoCD Helm repository
# -----------------------------------------------
echo "[1/5] Adding the ArgoCD Helm repository..."
helm repo add argo https://argoproj.github.io/argo-helm
echo "      Done."
echo ""

# -----------------------------------------------
# 2. Update Helm repositories
# -----------------------------------------------
echo "[2/5] Updating Helm repositories..."
helm repo update
echo "      Done."
echo ""

# -----------------------------------------------
# 3. Install ArgoCD via Helm
# -----------------------------------------------
echo "[3/5] Installing ArgoCD into the 'argocd' namespace..."
helm install argocd argo/argo-cd \
  -f argocd/values.yaml \
  -n argocd \
  --create-namespace
echo "      Done."
echo ""

# -----------------------------------------------
# 4. Wait for the ArgoCD server pod to be ready
# -----------------------------------------------
echo "[4/5] Waiting for ArgoCD server pod to be ready (timeout: 300s)..."
kubectl wait --for=condition=Ready pod \
  -l app.kubernetes.io/name=argocd-server \
  -n argocd \
  --timeout=300s
echo "      ArgoCD server is ready."
echo ""

# -----------------------------------------------
# 5. Retrieve the initial admin password
# -----------------------------------------------
echo "[5/5] Retrieving the initial admin password..."
ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d)

echo ""
echo "============================================"
echo "  ArgoCD Installation Complete!"
echo "============================================"
echo ""
echo "  Username : admin"
echo "  Password : ${ARGOCD_PASSWORD}"
echo ""
echo "  To get the ArgoCD UI URL, run:"
echo "    kubectl get svc argocd-server -n argocd -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'"
echo ""
echo "  Then open http://<EXTERNAL-IP> in your browser."
echo "============================================"
