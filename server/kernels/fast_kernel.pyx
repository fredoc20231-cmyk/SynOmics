# cython: boundscheck=False, wraparound=False, cdivision=True
"""Cython-accelerated numeric kernels for SynOmics self-optimizing compilation.

Compiled at runtime (via pyximport) when a pure-Python hot loop is too slow.
Correctness is asserted against the pure-Python reference before any speedup is
reported, so a wrong compiled result can never be presented as a win.
"""


def sum_sq_pairwise(double[::1] x):
    """Sum of squared pairwise differences: sum_{i<j} (x_i - x_j)^2 (O(n^2))."""
    cdef Py_ssize_t n = x.shape[0]
    cdef Py_ssize_t i, j
    cdef double total = 0.0
    cdef double d
    for i in range(n):
        for j in range(i + 1, n):
            d = x[i] - x[j]
            total += d * d
    return total
