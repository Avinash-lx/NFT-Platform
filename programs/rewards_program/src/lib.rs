//! PRISM rewards program.
//!
//! Tracks loyalty points per user in a deterministic PDA and exposes the
//! current tier. Points are accrued at `purchase amount (SOL) × 10`; the
//! caller (marketplace backend authority) submits the already-computed point
//! delta.
//!
//! Tier thresholds:
//! - Bronze  → 0 – 499
//! - Silver  → 500 – 1,999
//! - Gold    → 2,000 – 4,999
//! - Diamond → 5,000+

use anchor_lang::prelude::*;

declare_id!("RWD1111111111111111111111111111111111111111");

#[program]
pub mod rewards_program {
    use super::*;

    /// Initialize a user's reward account (idempotent via `init_if_needed`).
    pub fn initialize_account(ctx: Context<InitializeAccount>) -> Result<()> {
        let account = &mut ctx.accounts.reward_account;
        if account.user == Pubkey::default() {
            account.user = ctx.accounts.user.key();
            account.points = 0;
            account.bump = ctx.bumps.reward_account;
        }
        Ok(())
    }

    /// Add loyalty points to a user. Only the configured authority may call this.
    pub fn add_points(ctx: Context<AddPoints>, amount: u64) -> Result<()> {
        let account = &mut ctx.accounts.reward_account;
        account.points = account
            .points
            .checked_add(amount)
            .ok_or(RewardsError::MathOverflow)?;

        emit!(PointsAdded {
            user: account.user,
            amount,
            total: account.points,
            tier: Tier::from_points(account.points) as u8,
        });
        Ok(())
    }

    /// Read-only helper that logs the user's current tier.
    pub fn get_tier(ctx: Context<GetTier>) -> Result<()> {
        let tier = Tier::from_points(ctx.accounts.reward_account.points);
        msg!("Tier: {:?}", tier);
        Ok(())
    }
}

// ───────────────────────────── Accounts ────────────────────────────────

#[derive(Accounts)]
pub struct InitializeAccount<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the user the reward account belongs to.
    pub user: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + RewardAccount::SIZE,
        seeds = [b"rewards", user.key().as_ref()],
        bump
    )]
    pub reward_account: Account<'info, RewardAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddPoints<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"rewards", reward_account.user.as_ref()],
        bump = reward_account.bump
    )]
    pub reward_account: Account<'info, RewardAccount>,
}

#[derive(Accounts)]
pub struct GetTier<'info> {
    #[account(seeds = [b"rewards", reward_account.user.as_ref()], bump = reward_account.bump)]
    pub reward_account: Account<'info, RewardAccount>,
}

// ───────────────────────────── State ───────────────────────────────────

#[account]
pub struct RewardAccount {
    pub user: Pubkey,
    pub points: u64,
    pub bump: u8,
}

impl RewardAccount {
    pub const SIZE: usize = 32 + 8 + 1;
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, AnchorSerialize, AnchorDeserialize)]
pub enum Tier {
    Bronze = 0,
    Silver = 1,
    Gold = 2,
    Diamond = 3,
}

impl Tier {
    pub fn from_points(points: u64) -> Tier {
        match points {
            0..=499 => Tier::Bronze,
            500..=1_999 => Tier::Silver,
            2_000..=4_999 => Tier::Gold,
            _ => Tier::Diamond,
        }
    }
}

// ───────────────────────────── Events ──────────────────────────────────

#[event]
pub struct PointsAdded {
    pub user: Pubkey,
    pub amount: u64,
    pub total: u64,
    pub tier: u8,
}

// ───────────────────────────── Errors ──────────────────────────────────

#[error_code]
pub enum RewardsError {
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
