# Time-Critical Orbital Rendezvous via Lambert Solvers

**Modern Lambert-based trajectory planners achieve single-solve times under 2 microseconds while maintaining 13-digit precision across all orbit geometries.** The critical insight for performance engineering is that the choice of iteration method—Householder over Newton-Raphson—reduces average convergence from 5-8 iterations to 2, while Structure-of-Arrays data layouts enable full SIMD vectorization for batch trajectory searches. This survey provides the complete algorithmic stack from mathematical foundations through production-ready implementation patterns, targeting millisecond-scale individual solves and minute-scale batch scenarios on a modern 16-32 core workstation.

The Lambert problem—finding the velocity vectors that connect two position vectors in a given time under Keplerian dynamics—forms the computational kernel of nearly all impulsive rendezvous planners. Its solutions seed higher-fidelity trajectory optimization, enable rapid porkchop plot generation, and provide initial guesses for differential correction under perturbed dynamics. The landscape has evolved significantly since Lancaster-Blanchard's 1969 universal formulation, with Russell's 2022 interpolated vercosine solver now achieving **1.7-2.5× speedups** over the Gooding benchmark while handling 100,000+ revolutions reliably.

---

## Problem formulations anchor all trajectory planning

### Two-point boundary value for impulsive transfers

The classical Lambert problem seeks initial and final velocities satisfying:

**Given:** Position vectors **r₁** at epoch t₁ and **r₂** at epoch t₂ in ECI, gravitational parameter μ  
**Find:** Velocities **v₁**, **v₂** such that Keplerian propagation from (**r₁**, **v₁**) reaches **r₂** at time t₂

The transfer angle θ determines short-way versus long-way geometry:
```
cos(θ) = (r₁ · r₂) / (|r₁| |r₂|)
λ = sign(r₁ × r₂ · ĥ) · √(1 - c/s)
```
where c = |**r₂** - **r₁**| is chord length, s = (r₁ + r₂ + c)/2 is the semiperimeter, and ĥ is the orbit normal reference. The sign of λ encodes prograde (λ > 0) versus retrograde (λ < 0) transfer sense.

For time-of-flight Δt longer than the minimum-energy transfer, **2N + 1 distinct solutions** exist for N complete revolutions. Each N > 0 admits both a short-period (higher energy, faster orbit) and long-period branch, distinguished by semi-major axis.

### Time-critical rendezvous planning extends beyond fixed-time Lambert

When departure epoch t₁, arrival epoch t₂, or both are decision variables, the problem becomes:

**Minimize:** Total impulse Σ|Δv|, or transfer time (t₂ - t₁), or miss distance at closest approach  
**Subject to:** Δv bounds, thrust limits, arrival v∞ constraints, revolution count constraints

The "minimum miss distance at closest approach" variant searches over (t₁, TOF) to achieve d_min ≤ threshold, critical for proximity operations and debris avoidance maneuvers.

### Relative motion approximations seed Lambert refinement

The **Clohessy-Wiltshire (Hill) equations** linearize relative dynamics about a circular reference orbit:
```
ẍ - 2nẏ - 3n²x = fₓ/m
ÿ + 2nẋ = fᵧ/m
z̈ + n²z = f_z/m
```
where n = √(μ/a³) is mean motion. The closed-form state transition matrix enables microsecond-scale trajectory estimates with **1-10 km position error**—sufficient for pruning trajectory grids before Lambert refinement.

For elliptical reference orbits, the **Tschauner-Hempel equations** with the Yamanaka-Ankersen STM extend validity to arbitrary eccentricity at ~3× the computational cost of CW, achieving **~100 m position error** for moderate eccentricities.

**Validity domains:**
- CW: e < 0.01, relative separation < 100 km
- TH: e < 0.3, relative separation < 500 km
- Full Lambert: All geometries, all orbit types

---

## Lambert solver taxonomy reveals speed-robustness tradeoffs

The table below summarizes the practical solver landscape:

| Algorithm | Iteration Method | Avg Iterations (M=0) | Robustness | Relative Speed | Multi-Rev | Best Regime |
|-----------|-----------------|---------------------|------------|----------------|-----------|-------------|
| **Russell ivLam2** (2022) | Newton + interpolation | 1-2 | Excellent | **2.5×** | Yes (N>100k) | Production, sensitivities |
| **Izzo** (2015) | Householder 4th-order | 2 | Very good | **1.25×** | Yes | General purpose, GPU |
| **Gooding** (1990) | Halley 3rd-order | 3 | Excellent | 1.0× (baseline) | Yes (bounded) | Reliability-critical |
| **Battin** (1984) | Continued fractions | Variable | Excellent | 0.5× | Yes | Near-180° transfers |
| **Universal Variable** | Newton-Raphson | 5-10 | Good | 0.8× | Limited | Educational, SIMD |
| **Gauss** | Successive substitution | 30-50 | Poor | 0.3× | No | Historical only |

### Key mathematical formulations

**Lancaster-Blanchard universal variables** (foundation for Gooding/Izzo):
```
T = √(2μ/s³) · (t₂ - t₁)           # Non-dimensional TOF
x ∈ [-1, 1] for elliptic            # Iteration variable
y = √(1 - λ²(1 - x²))
T = [ψ + Mπ·√|1-x²| - x + λy] / (1 - x²)
```

**Izzo's logarithmic transformation** improves convergence:
```
ξ = log(1 + x)        for M = 0
ξ = log((1+x)/(1-x))  for M > 0
```

**Householder iteration** (4th order, used by Izzo):
```
xₙ₊₁ = xₙ - f · (f'² - f·f''/2) / [f'(f'² - f·f'') + f'''·f²/6]
```

**Russell's interpolated initial guess** eliminates iteration overhead:
- 1 MB precomputed biquintic spline coefficients
- Covers entire (λ, T, N) parameter space
- Single interpolation → 1-2 iterations to machine precision
- Analytical first/second-order sensitivities (∂v/∂t, ∂v/∂r) 6-17× faster than finite differences

### Multi-revolution enumeration

For transfer time T* and revolution count N:
1. Compute Tₘᵢₙ(N) via Halley iteration on dT/dx = 0
2. If T* < Tₘᵢₙ(N), no N-revolution solution exists
3. For each valid N, solve for short-period (x ∈ [xₘᵢₙ, 1]) and long-period (x ∈ [-1, xₘᵢₙ]) roots
4. Select by mission objective (minimum Δv typically favors long-period for N > 0)

### Critical edge cases and mitigations

**Near-antipodal (θ ≈ 180°):** Transfer plane undefined. Battin's method handles θ = π explicitly; alternatively, supply orbit plane normal as additional constraint.

**Near-parabolic (x ≈ 1):** Catastrophic cancellation in (1-x²). Battin's hypergeometric series or Izzo's log transformation eliminates numerical instability.

**Stumpff function overflow (large |z|):** Use series expansion for |z| < 0.1:
```
C(z) ≈ 1/2 - z/24 + z²/720 - z³/40320
S(z) ≈ 1/6 - z/120 + z²/5040 - z³/362880
```

**Degeneracy (r₁ ≈ r₂, θ small):** Log-scale transformations in Russell/Izzo handle naturally; explicit tolerance checking required for classical methods.

---

## Rendezvous planner architecture integrates search and refinement

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RENDEZVOUS PLANNER PIPELINE                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────────┐    ┌─────────────────┐   │
│  │ EPHEMERIS /  │───▶│ CANDIDATE TIME   │───▶│ LAMBERT SOLVER  │   │
│  │ PROPAGATOR   │    │ GENERATOR        │    │ BANK            │   │
│  └──────────────┘    │ • Grid search    │    │ • Izzo (fast)   │   │
│  • SPICE/TLE         │ • CW/TH filter   │    │ • Gooding (safe)│   │
│  • SGP4 (TLE)        │ • Energy bounds  │    │ • Russell (opt) │   │
│  • J2 analytical     │ • Synodic window │    └────────┬────────┘   │
│  • Full numerical    └──────────────────┘             │             │
│                                                        ▼             │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   OBJECTIVE EVALUATION                        │   │
│  │  • Total Δv = |v₁ - v_departure| + |v₂ - v_arrival|          │   │
│  │  • Arrival v∞ constraint check                                │   │
│  │  • Miss distance at closest approach                          │   │
│  │  • Multi-rev branch selection (min Δv or min time)            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────┐    ┌──────────────────┐    ┌─────────────────┐   │
│  │ PERTURBATION │◀───│ DIFFERENTIAL     │◀───│ SOLUTION        │   │
│  │ PROPAGATOR   │    │ CORRECTION       │    │ SELECTION       │   │
│  │ • DOP853     │    │ • STM-based      │    │ • Pareto front  │   │
│  │ • J2/drag/SRP│    │ • Multiple shoot │    │ • Δv budget     │   │
│  │ • STM output │    │ • Lambert re-seed│    │ • Time window   │   │
│  └──────────────┘    └──────────────────┘    └─────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Six search and optimization strategies address different scenarios

### Strategy 1: Grid search with geometric pruning

Generate porkchop plot over departure/arrival window, with pruning to eliminate infeasible regions:

```python
def porkchop_with_pruning(t_dep_range, t_arr_range, delta_v_max, mu):
    """Grid search with energy-based and geometric pruning."""
    results = []
    
    for t_d in linspace(t_dep_range, resolution=100):
        r1, v_dep = ephemeris(departure_body, t_d)
        
        for t_a in linspace(t_arr_range, resolution=100):
            tof = t_a - t_d
            if tof < tof_min: continue  # TOF pruning
            
            r2, v_arr = ephemeris(arrival_body, t_a)
            
            # GEOMETRIC FILTER: Skip near-antipodal
            cos_theta = dot(r1, r2) / (norm(r1) * norm(r2))
            if abs(cos_theta + 1) < 1e-3: continue  # θ ≈ 180°
            
            # ENERGY BOUND: Hohmann lower bound
            dv_hohmann = hohmann_delta_v(norm(r1), norm(r2), mu)
            if dv_hohmann > delta_v_max: continue
            
            # LAMBERT SOLVE
            try:
                v1, v2 = lambert_izzo(r1, r2, tof, mu, M=0)
                dv_total = norm(v1 - v_dep) + norm(v2 - v_arr)
                if dv_total < delta_v_max:
                    results.append((t_d, t_a, dv_total, v1, v2))
            except ConvergenceError:
                continue  # Fallback: mark as infeasible
    
    return results
```

**Parallelization:** Distribute departure dates across CPU cores; use GPU for >10k grid points.

### Strategy 2: Root-finding on time constraints

When seeking specific arrival conditions (e.g., phase angle match):

```python
def find_tof_for_phase_match(r1, target_phase, mu, tof_bracket):
    """Find TOF such that arrival phase matches target."""
    
    def residual(tof):
        r2 = propagate_target(t_departure + tof)
        v1, v2 = lambert_gooding(r1, r2, tof, mu)
        arrival_phase = atan2(r2[1], r2[0])
        return wrap_angle(arrival_phase - target_phase)
    
    # Brent's method: guaranteed convergence within bracket
    tof_optimal = brentq(residual, tof_bracket[0], tof_bracket[1], xtol=1e-6)
    return tof_optimal
```

### Strategy 3: NLP optimization with Lambert subroutine

Direct optimization over timing and revolution count:

```python
def nlp_rendezvous_optimizer(x0, bounds, constraints):
    """
    Decision variables: x = [t_departure, tof, N_revolutions]
    Objective: minimize total Δv
    """
    
    def objective(x):
        t_d, tof, N = x[0], x[1], int(round(x[2]))
        r1 = ephemeris_chaser(t_d)
        r2 = ephemeris_target(t_d + tof)
        
        # Enumerate all N-rev solutions, select minimum Δv
        solutions = lambert_multi_rev(r1, r2, tof, mu, M_max=N)
        dv_min = min(compute_delta_v(s) for s in solutions)
        return dv_min
    
    def arrival_velocity_constraint(x):
        # v∞ at arrival must be below threshold
        _, v2 = lambert_solve(...)
        v_inf = norm(v2 - v_target)
        return v_inf_max - v_inf  # ≥ 0 for feasibility
    
    result = minimize(objective, x0, method='SLSQP',
                     bounds=bounds,
                     constraints={'type': 'ineq', 'fun': arrival_velocity_constraint})
    return result
```

### Strategy 4: Multi-fidelity CW → Lambert cascade

Exploit linear models for rapid pruning before expensive Lambert solves:

```python
def multi_fidelity_search(chaser_state, target_state, search_window):
    """CW-based coarse search, Lambert refinement."""
    
    # PHASE 1: Coarse search with Clohessy-Wiltshire (~1 μs per eval)
    cw_stm = compute_cw_stm(mean_motion)
    candidates = []
    
    for tof in linspace(search_window, resolution=1000):
        # CW delta-v estimate
        delta_r = target_position(tof) - chaser_position
        dv_cw = cw_required_velocity(delta_r, tof, cw_stm)
        
        if norm(dv_cw) < dv_budget * 1.5:  # 50% margin for CW error
            candidates.append((tof, dv_cw))
    
    # PHASE 2: Lambert refinement on top 10% candidates (~10 μs per eval)
    refined = []
    candidates.sort(key=lambda c: norm(c[1]))
    
    for tof, _ in candidates[:len(candidates)//10]:
        r1 = chaser_position
        r2 = target_position(tof)
        v1, v2 = lambert_izzo(r1, r2, tof, mu)
        dv_actual = norm(v1 - chaser_velocity)
        refined.append((tof, dv_actual, v1))
    
    return min(refined, key=lambda r: r[1])
```

### Strategy 5: Differential correction with perturbed dynamics

Refine Lambert seed under J2, drag, and higher-fidelity models:

```python
def differential_correction_lambert(r1, r2, t1, t2, mu, perturbations,
                                    tol=1e-10, max_iter=20):
    """
    Corrects Lambert v₁ to hit r₂ under perturbed dynamics.
    Uses STM-based Newton iteration.
    """
    # Initial guess from two-body Lambert
    v1 = lambert_izzo(r1, r2, t2-t1, mu)[0]
    
    for iteration in range(max_iter):
        # Propagate state AND STM with perturbations
        state0 = concatenate([r1, v1])
        state_f, STM = propagate_with_variational_stm(
            state0, t1, t2, perturbations)
        
        r2_actual = state_f[:3]
        delta_r = r2 - r2_actual
        
        # Convergence check
        if norm(delta_r) < tol:
            return v1, iteration
        
        # Extract Φ_rv: sensitivity of final position to initial velocity
        Phi_rv = STM[:3, 3:6]  # 3×3 partition
        
        # Newton update: δv₁ = Φ_rv⁻¹ · δr
        delta_v1 = solve(Phi_rv, delta_r)
        v1 = v1 + delta_v1
    
    raise ConvergenceError(f"Did not converge in {max_iter} iterations")


def propagate_with_variational_stm(state0, t0, tf, perturbations):
    """Co-integrate state (6) + STM (36) = 42 ODEs."""
    STM0 = eye(6).flatten()
    y0 = concatenate([state0, STM0])
    
    def derivatives(t, y):
        state, STM = y[:6], y[6:].reshape(6, 6)
        
        # Acceleration with perturbations
        accel = two_body_accel(state, mu)
        if 'J2' in perturbations:
            accel += j2_acceleration(state)
        if 'drag' in perturbations:
            accel += drag_acceleration(state, t)
        
        state_dot = concatenate([state[3:6], accel])
        
        # STM derivatives: dΦ/dt = A(t) · Φ
        A = compute_dynamics_jacobian(state, perturbations)
        STM_dot = (A @ STM).flatten()
        
        return concatenate([state_dot, STM_dot])
    
    sol = solve_ivp(derivatives, [t0, tf], y0, method='DOP853',
                   rtol=1e-13, atol=1e-15)
    return sol.y[:6, -1], sol.y[6:, -1].reshape(6, 6)
```

### Strategy 6: Monte Carlo uncertainty quantification

Robust planning under state covariance:

```python
def monte_carlo_miss_probability(trajectory_params, state_covariance,
                                  miss_threshold, n_samples=10000):
    """
    Estimate probability of achieving miss distance ≤ threshold
    under state uncertainty.
    """
    r1_mean, v1_mean = trajectory_params['r1'], trajectory_params['v1']
    
    # Sample from state distribution
    samples = multivariate_normal(
        mean=concatenate([r1_mean, v1_mean]),
        cov=state_covariance,
        size=n_samples)
    
    miss_distances = []
    for sample in samples:
        r1_sample, v1_sample = sample[:3], sample[3:6]
        
        # Propagate to closest approach
        trajectory = propagate(r1_sample, v1_sample, t_final)
        d_min = find_closest_approach(trajectory, target_trajectory)
        miss_distances.append(d_min)
    
    # Compute statistics
    p_success = sum(d <= miss_threshold for d in miss_distances) / n_samples
    d_mean, d_std = mean(miss_distances), std(miss_distances)
    
    return {
        'probability_success': p_success,
        'miss_mean': d_mean,
        'miss_std': d_std,
        'miss_95_percentile': percentile(miss_distances, 95)
    }
```

---

## Perturbation handling requires orbit-regime awareness

### Perturbation magnitudes by orbit

| Orbit | Primary | Secondary | Negligible |
|-------|---------|-----------|------------|
| **LEO (<600 km)** | J2, Drag | J3-J4, Moon/Sun | SRP (unless high A/m) |
| **MEO** | J2, Moon/Sun | J3-J6 | Drag |
| **GEO** | J2, Moon/Sun, SRP | Tesseral (C22, S22) | Drag |
| **HEO** | Moon/Sun, J2 | SRP | Drag (except perigee) |

### J2 acceleration (Cartesian, Earth-centered)

```
a_J2 = (3/2) · J2 · μ · Rₑ² / r⁴ · [
    (x/r)(5z²/r² - 1),
    (y/r)(5z²/r² - 1),
    (z/r)(5z²/r² - 3)
]
```
with J2 = **1.08263 × 10⁻³**, Rₑ = 6378.137 km, μ = 398600.4418 km³/s².

### Multiple shooting for long-arc problems

When single-shooting differential correction diverges (typically for propagation times >1 orbit period), segment the trajectory:

```python
def multiple_shooting_correction(nodes, times, target_r, tol=1e-10):
    """
    nodes: List of [r, v] states at segment boundaries
    times: Corresponding epochs
    target_r: Final position constraint
    """
    n_segments = len(nodes) - 1
    
    while True:
        defects = []
        jacobian = build_sparse_jacobian(n_segments)
        
        for i in range(n_segments):
            # Propagate segment
            state_f, STM = propagate_with_stm(nodes[i], times[i], times[i+1])
            
            # Continuity defect
            defect = state_f - nodes[i+1]
            defects.append(defect)
            
            # Fill Jacobian: d(defect_i)/d(node_i) = STM, d(defect_i)/d(node_{i+1}) = -I
            jacobian[i*6:(i+1)*6, i*6:(i+1)*6] = STM
            jacobian[i*6:(i+1)*6, (i+1)*6:(i+2)*6] = -eye(6)
        
        # Terminal constraint
        defects.append(nodes[-1][:3] - target_r)
        
        # Solve banded system
        corrections = solve_banded(jacobian, flatten(defects))
        
        # Update nodes
        for i, node in enumerate(nodes):
            node += corrections[i*6:(i+1)*6]
        
        if norm(flatten(defects)) < tol:
            return nodes
```

---

## Performance engineering delivers order-of-magnitude speedups

### Profiling hotspots in Lambert solvers

| Operation | % Runtime | Optimization Strategy |
|-----------|-----------|----------------------|
| Stumpff functions | 30-40% | Half-angle formulas, series expansion |
| Trigonometric (sin/cos) | 25-35% | Wisdom-Hernandez reformulation |
| Iteration convergence | 10-15% | Householder over Newton |
| Velocity reconstruction | 10% | Precompute common subexpressions |

### Structure of Arrays for SIMD vectorization

**Recommended data layout:**
```c
struct LambertBatch {
    alignas(64) double r1_x[N], r1_y[N], r1_z[N];  // Initial positions
    alignas(64) double r2_x[N], r2_y[N], r2_z[N];  // Final positions
    alignas(64) double tof[N];                      // Time of flight
    alignas(64) double v1_x[N], v1_y[N], v1_z[N];  // Output velocities
};
```

SoA achieves **100% cache efficiency** versus 37.5% for Array-of-Structures, and enables direct `_mm256_load_pd` SIMD operations without gather/scatter overhead.

### Nondimensionalization prevents numerical overflow

```python
# Canonical units: DU = characteristic length, TU = sqrt(DU³/μ), VU = DU/TU
DU = mean_orbit_radius  # or Earth radius, AU, etc.
TU = sqrt(DU**3 / mu)
VU = DU / TU

# All calculations in canonical units where μ_canonical = 1
r1_norm, r2_norm = r1 / DU, r2 / DU
tof_norm = tof / TU
v1_norm, v2_norm = lambert_solve(1.0, r1_norm, r2_norm, tof_norm)

# Convert back
v1, v2 = v1_norm * VU, v2_norm * VU
```

### Safeguarded Newton iteration

```python
def safeguarded_newton(f, df, x0, bracket, tol=1e-12, maxiter=50):
    """Newton-Raphson with bisection fallback."""
    a, b = bracket
    x = x0
    
    for iteration in range(maxiter):
        fx, dfx = f(x), df(x)
        
        if abs(fx) < tol:
            return x, iteration, True
        
        if abs(dfx) < 1e-15:  # Derivative too small
            x = (a + b) / 2   # Bisect instead
            continue
        
        dx = -fx / dfx
        x_new = x + dx
        
        # Safeguard: stay within bracket
        if x_new < a or x_new > b:
            x_new = (a + b) / 2
        
        # Update bracket
        if f(x_new) * f(a) < 0:
            b = x_new
        else:
            a = x_new
        
        x = x_new
    
    return x, maxiter, False
```

### Runtime targets by platform

| Platform | Single Solve | 10k Batch | 1M Grid |
|----------|--------------|-----------|---------|
| Single CPU core | 1-5 μs | 10-50 ms | 1-5 s |
| CPU 8-core AVX2 | 0.5-2 μs | 2-10 ms | 0.2-1 s |
| GPU (RTX 3080+) | N/A | 0.5-2 ms | 20-100 ms |

GPU becomes beneficial above **~10,000 concurrent Lambert solves**.

---

## Benchmark plan validates implementation correctness

### Scenario suite

| Scenario | Characteristics | Key Challenge |
|----------|-----------------|---------------|
| **LEO-to-LEO** | Short TOF (~90 min), e ≈ 0 | High precision required |
| **GEO servicing** | Coplanar, 24-hour period | Transfer angle sensitivity |
| **HEO (Molniya)** | e > 0.7, large apogee | Near-antipodal geometry |
| **Near-antipodal** | θ ≈ 180° ± 5° | Numerical singularity |
| **Multi-revolution** | M = 1, 2, 5, 20, 100 | Tₘᵢₙ calculation, branch selection |
| **Hyperbolic escape** | C3 > 0 | Large Stumpff arguments |

### Metrics

- **Accuracy:** Position error at arrival (vs high-fidelity propagation), Δv residual
- **Speed:** μs per solve, throughput (solves/second), scaling with batch size
- **Robustness:** % converged across 100,000 random geometries (λ ∈ [-0.999, 0.999], x ∈ [-0.99, 3])
- **Energy bias:** Sign of orbital energy error (should be symmetric/random)

### Validation sources

- **Vallado test cases:** Standard reference vectors (ISBN 978-1881883210)
- **pykep validation:** 100,000 random Lambert problems
- **GTOC problems:** gtoc.esa.int competition archives
- **Cross-validation:** poliastro vs Orekit vs GMAT for same scenarios

---

## Implementation recommendations by language

| Language | Use Case | Key Libraries |
|----------|----------|---------------|
| **C++** | Production flight software | Eigen, Boost.Odeint, cspice |
| **Rust** | Safety-critical + performance | nyx, hifitime, ANISE |
| **Julia** | Research, rapid prototyping | DifferentialEquations.jl, GeneralAstrodynamics.jl |
| **Python** | Education, analysis workflows | poliastro, pykep, SpiceyPy, Astropy |

### Library selection

- **Lambert solver:** pykep (Izzo, C++/Python) or poliastro (Izzo, Python+numba)
- **Ephemeris/frames:** SPICE via SpiceyPy or ANISE (Rust, JPL-developed replacement)
- **Numerical integration:** DOP853 (scipy.integrate or DifferentialEquations.jl)
- **Trajectory optimization:** pygmo + pykep (ESA), or SNOPT via GMAT

### Testing strategy

1. **Invariants:** Verify energy and angular momentum conservation (two-body)
2. **Regression:** Vallado test vectors as baseline suite
3. **Randomized:** 10,000+ random geometries, verify forward/backward consistency
4. **Cross-validation:** Compare with at least two independent implementations
5. **Edge cases:** Near-circular, near-parabolic, near-antipodal explicitly tested

---

## Recommended default stack for workstation implementation

**For a 16-32 core CPU targeting millisecond single-solve and minute-scale batch scenarios:**

| Component | Recommendation | Rationale |
|-----------|----------------|-----------|
| **Lambert solver** | **Izzo (pykep/poliastro)** | Best speed/robustness ratio; 2 iterations typical; simple implementation |
| **Multi-rev extension** | Russell ivLam2 for N > 10 | Interpolated guess handles 100k+ revolutions |
| **Search strategy** | Grid + geometric pruning → NLP refinement | CW filter reduces Lambert calls 10×; SLSQP for final optimization |
| **Integrator** | **DOP853** (rtol=1e-13, atol=1e-15) | Best energy conservation; ~0.1 m error over 3 days |
| **Perturbations** | J2 + drag (LEO) or J2 + Moon/Sun (higher orbits) | Cover dominant effects; STM via variational equations |
| **Parallelization** | OpenMP dynamic scheduling, SoA layout | Scale to all cores; SIMD-friendly memory access |
| **Frames/ephemeris** | SPICE (SpiceyPy) or ANISE | Industry standard; machine-precision frame transforms |

**Why this stack:**

Izzo's algorithm provides the optimal balance for general-purpose use—**1.25× faster than Gooding** with comparable robustness, and the simplest mathematical formulation among modern solvers. The Householder iteration converges reliably in 2 steps across nearly all geometries, and the Python implementations (pykep, poliastro) achieve near-Fortran speeds through numba JIT compilation.

For production systems requiring sensitivities (trajectory optimization, covariance analysis), Russell's ivLam2 solver adds analytical first and second derivatives **6-17× faster than finite differences**, justifying the additional implementation complexity and 1 MB coefficient file.

The DOP853 integrator with tight tolerances (1e-13/1e-15) preserves orbital energy to sub-meter accuracy over multi-day propagations—essential for differential correction convergence. Combined with variational STM computation (42 ODEs total), this enables robust Newton-based trajectory refinement even under significant perturbations.

For batch scenarios exceeding 10,000 evaluations (e.g., porkchop plot generation), transition to GPU-accelerated Lambert solvers yields **50-100× throughput improvement** over CPU parallelization. The SoA data layout enables this transition without algorithm changes.