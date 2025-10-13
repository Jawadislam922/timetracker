<?php

namespace App\Policies;

use App\Models\EmployeePortfolio;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class EmployeePortfolioPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return true; // Users can view their own portfolios
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, EmployeePortfolio $employeePortfolio): bool
    {
        return $user->id === $employeePortfolio->user_id;
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return true; // All authenticated users can create portfolios
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, EmployeePortfolio $employeePortfolio): bool
    {
        return $user->id === $employeePortfolio->user_id;
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, EmployeePortfolio $employeePortfolio): bool
    {
        return $user->id === $employeePortfolio->user_id;
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, EmployeePortfolio $employeePortfolio): bool
    {
        return $user->id === $employeePortfolio->user_id;
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, EmployeePortfolio $employeePortfolio): bool
    {
        return $user->id === $employeePortfolio->user_id;
    }

    /**
     * Determine whether the user can publish the model.
     */
    public function publish(User $user, EmployeePortfolio $employeePortfolio): bool
    {
        return $user->id === $employeePortfolio->user_id;
    }
}
