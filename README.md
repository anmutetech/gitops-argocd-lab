# GitOps with ArgoCD Lab

Learn GitOps principles by deploying and managing Kubernetes applications using ArgoCD on an AWS EKS cluster.

By the end of this lab you will understand how GitOps works in practice — using Git as the single source of truth for your infrastructure, with ArgoCD automatically syncing your cluster to match.

---

## What is GitOps?

GitOps is an operational model that uses **Git as the single source of truth** for declarative infrastructure and application configuration. The core principles are:

1. **Declarative** — The entire desired state of the system is described declaratively (Kubernetes YAML manifests, Helm charts, Kustomize overlays, etc.).
2. **Versioned and immutable** — The desired state is stored in Git, giving you a full audit trail of every change.
3. **Pulled automatically** — An agent (ArgoCD) running inside the cluster continuously pulls the desired state from Git and applies it.
4. **Self-healing** — If someone makes a manual change to the cluster, the agent detects the drift and reverts it back to the Git-defined state.

ArgoCD is a popular, CNCF-graduated GitOps tool that watches your Git repositories and keeps your Kubernetes clusters in sync.

---

## What Gets Created

| Resource | Description |
|---|---|
| **ArgoCD** (Helm release in `argocd` namespace) | The GitOps controller — watches Git and syncs your cluster |
| **ArgoCD Application CR** (`sample-app`) | Tells ArgoCD which repo/path to watch and where to deploy |
| **Namespace** `sample-app-ns` | Isolated namespace for the sample application |
| **Deployment** `sample-app` | Nginx deployment with 2 replicas, health probes, and resource limits |
| **Service** `sample-app` (LoadBalancer) | Exposes the nginx deployment on an AWS load balancer |

---

## Prerequisites

Before starting this lab, make sure you have the following:

- **EKS cluster running** — The `migration-eks-cluster` in `us-east-1` from the [cloud-migration-infra](https://github.com/anmutetech/cloud-migration-infra) lab
- **kubectl** — Configured and pointing at your EKS cluster (`kubectl get nodes` should return your nodes)
- **Helm 3** — Installed on your local machine ([install guide](https://helm.sh/docs/intro/install/))
- **Git** — Installed and configured with your GitHub credentials
- **GitHub account** — You will fork this repo into your own account

---

## Lab Steps

### Step 1: Fork and Clone the Repository

1. Fork this repository to your own GitHub account by clicking the **Fork** button on the GitHub page.

2. Clone your fork:

```bash
git clone https://github.com/<your-username>/gitops-argocd-lab.git
cd gitops-argocd-lab
```

> Replace `<your-username>` with your GitHub username throughout this lab.

---

### Step 2: Install ArgoCD on EKS

Run the installation script from the root of the repository:

```bash
chmod +x argocd/install.sh
./argocd/install.sh
```

**What the script does:**

1. Adds the official ArgoCD Helm chart repository
2. Runs `helm repo update` to fetch the latest chart versions
3. Installs ArgoCD into the `argocd` namespace using the custom values in `argocd/values.yaml`
4. Waits for the ArgoCD server pod to become ready
5. Retrieves and prints the initial admin password

The custom `values.yaml` configures two things:
- **LoadBalancer service** — So you can access the ArgoCD UI from your browser
- **Insecure mode** — Disables TLS for simplicity in this lab environment

Verify the installation:

```bash
kubectl get pods -n argocd
```

You should see several pods running, including `argocd-server`, `argocd-repo-server`, `argocd-application-controller`, and `argocd-redis`.

---

### Step 3: Access the ArgoCD UI

1. **Get the ArgoCD LoadBalancer URL:**

```bash
kubectl get svc argocd-server -n argocd -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

> It may take 2-3 minutes for the load balancer to be provisioned. If the command returns empty, wait and try again.

2. **Open the URL** in your browser: `http://<LOAD_BALANCER_HOSTNAME>`

3. **Log in** with:
   - **Username:** `admin`
   - **Password:** The password printed by the install script. You can also retrieve it again:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

You should see the ArgoCD dashboard with no applications deployed yet.

---

### Step 4: Update the ArgoCD Application CR

Open `apps/sample-app-argocd.yaml` in your editor and replace `<your-username>` with your actual GitHub username:

```yaml
source:
  repoURL: https://github.com/<your-username>/gitops-argocd-lab.git
```

For example, if your GitHub username is `jdoe`:

```yaml
source:
  repoURL: https://github.com/jdoe/gitops-argocd-lab.git
```

Commit and push this change:

```bash
git add apps/sample-app-argocd.yaml
git commit -m "Update repoURL with my GitHub username"
git push origin main
```

---

### Step 5: Deploy the Application via ArgoCD

Apply the ArgoCD Application custom resource to your cluster:

```bash
kubectl apply -f apps/sample-app-argocd.yaml
```

This does **not** deploy the sample app directly. Instead, it creates an Application resource in ArgoCD that tells it: "Watch this Git repo, read the manifests in the `sample-app` directory, and deploy them to the `sample-app-ns` namespace."

---

### Step 6: Watch ArgoCD Sync

1. Go back to the **ArgoCD UI** in your browser.
2. You should now see the `sample-app` Application tile.
3. Click on it to see the detailed sync view.
4. ArgoCD will automatically:
   - Clone your repository
   - Detect the manifests under `sample-app/`
   - Create the namespace, deployment, and service on your cluster
   - Report the sync status as **Synced** and health status as **Healthy**

You can also check the sync status from the command line:

```bash
kubectl get applications -n argocd
```

---

### Step 7: Verify the Deployment

1. **Check that the pods are running:**

```bash
kubectl get pods -n sample-app-ns
```

You should see 2 nginx pods in `Running` state.

2. **Check the service:**

```bash
kubectl get svc -n sample-app-ns
```

3. **Access the application** by getting the LoadBalancer URL:

```bash
kubectl get svc sample-app -n sample-app-ns -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

Open `http://<HOSTNAME>` in your browser. You should see the default nginx welcome page.

---

### Step 8: Make a Change and Watch Auto-Sync

This is where GitOps shines. Instead of running `kubectl` commands to update your deployment, you make changes in Git and ArgoCD applies them automatically.

1. **Edit** `sample-app/deployment.yaml` — change `replicas` from `2` to `4`:

```yaml
spec:
  replicas: 4
```

2. **Commit and push:**

```bash
git add sample-app/deployment.yaml
git commit -m "Scale sample-app to 4 replicas"
git push origin main
```

3. **Watch ArgoCD detect the change:**
   - In the ArgoCD UI, you will see the application briefly go **OutOfSync**
   - Because auto-sync is enabled, ArgoCD will automatically apply the change
   - Within a minute or two, the status returns to **Synced**

4. **Verify:**

```bash
kubectl get pods -n sample-app-ns
```

You should now see 4 pods running. You never ran `kubectl apply` or `kubectl scale` — ArgoCD did it for you based on the Git commit.

---

### Step 9: Test Self-Healing

Self-healing means ArgoCD will revert any manual changes made directly to the cluster.

1. **Manually delete a pod:**

```bash
kubectl delete pod -n sample-app-ns -l app=sample-app --field-selector=status.phase=Running --wait=false | head -1
```

Or pick a specific pod:

```bash
kubectl get pods -n sample-app-ns
kubectl delete pod <pod-name> -n sample-app-ns
```

2. **Watch what happens:**
   - Kubernetes itself will recreate the pod (because the Deployment controller maintains the replica count).
   - If you were to make a more invasive change — like scaling the deployment down with `kubectl scale` — ArgoCD would detect the drift and scale it back up to match Git.

3. **Try a drift test:**

```bash
kubectl scale deployment sample-app -n sample-app-ns --replicas=1
```

Watch the ArgoCD UI — it will detect the drift, mark the app as **OutOfSync**, and automatically scale it back to the Git-defined replica count.

---

### Step 10: Rollback via the ArgoCD UI

ArgoCD keeps a history of every sync operation. To roll back:

1. Open the **sample-app** in the ArgoCD UI.
2. Click on **History and Rollback** in the top navigation.
3. You will see a list of previous sync operations with their Git commit SHAs.
4. Select a previous revision and click **Rollback**.
5. ArgoCD will redeploy the manifests from that specific Git commit.

> **Note:** With automated sync enabled, ArgoCD will eventually re-sync to the latest commit in `main`. To keep a rollback permanent, you would revert the commit in Git itself (`git revert`).

---

## Cleanup

When you are done with the lab, clean up in this order:

1. **Delete the ArgoCD Application** (this removes the deployed sample-app resources):

```bash
kubectl delete application sample-app -n argocd
```

2. **Verify the sample-app resources are removed:**

```bash
kubectl get all -n sample-app-ns
```

3. **Uninstall ArgoCD:**

```bash
helm uninstall argocd -n argocd
```

4. **Delete the argocd namespace:**

```bash
kubectl delete namespace argocd
```

5. **Delete the sample-app namespace** (if it still exists):

```bash
kubectl delete namespace sample-app-ns
```

> To tear down the EKS cluster itself, follow the cleanup instructions in the [cloud-migration-infra](https://github.com/anmutetech/cloud-migration-infra) repository.

---

## What You Learned

- **GitOps principles** — Using Git as the single source of truth for Kubernetes deployments
- **ArgoCD installation** — Deploying ArgoCD on EKS using Helm
- **Application CRs** — Defining ArgoCD Application resources to connect Git repos to cluster namespaces
- **Automated sync** — ArgoCD detecting Git changes and applying them without manual intervention
- **Self-healing** — ArgoCD reverting manual cluster modifications to match the Git-defined state
- **Rollback** — Using ArgoCD's sync history to revert to previous application states
- **Declarative deployments** — Managing all infrastructure changes through version-controlled manifests

---

## Project Structure

```
gitops-argocd-lab/
├── README.md                          # This file — lab instructions
├── argocd/
│   ├── install.sh                     # ArgoCD installation script (Helm)
│   └── values.yaml                    # Custom Helm values for ArgoCD
├── apps/
│   ├── sample-app-argocd.yaml         # ArgoCD Application CR for sample-app
│   └── calculator-app-argocd.yaml     # ArgoCD Application CR template for calculator-app
└── sample-app/
    ├── namespace.yaml                 # Namespace: sample-app-ns
    ├── deployment.yaml                # Nginx deployment (2 replicas)
    └── service.yaml                   # LoadBalancer service (port 80)
```
