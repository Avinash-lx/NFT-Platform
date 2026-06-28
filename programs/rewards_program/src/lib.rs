//! PRISM rewards program.
//!
//! Tracks loyalty points per user in a deterministic PDA and exposes the
//! current tier. Points are accrued at `purchase amount (SOL) × 10`.
//!
//! Point accrual is **program-enforced**: `add_points` may only be called by the
//! configured authority. The marketplace program holds that authority as a PDA
//! and credits points via CPI inside `buy_nft`, so points cannot be minted by
//! arbitrary callers or the backend.
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

    /// One-time config: set the authority allowed to credit points. This is the
    /// marketplace's `["rewards_authority"]` PDA.
    pub fn initialize_config(ctx: Context<InitializeConfig>, authority: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = authority;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    /// Update the points authority (config admin only).
    pub fn set_authority(ctx: Context<SetAuthority>, authority: Pubkey) -> Result<()> {
        ctx.accounts.config.authority = authority;
        Ok(())
    }

    /// Credit loyalty points to a user. Authorized via `config.authority`
    /// (the marketplace rewards PDA). The user's reward account is created on
    /// first use. Designed to be called via CPI from `buy_nft`.
    pub fn add_points(ctx: Context<AddPoints>, amount: u64) -> Result<()> {
        let account = &mut ctx.accounts.reward_account;
        if account.user == Pubkey::default() {
            account.user = ctx.accounts.user.key();
            account.bump = ctx.bumps.reward_account;
        }
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
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + RewardsConfig::SIZE,
        seeds = [b"rewards_config"],
        bump
    )]
    pub config: Account<'info, RewardsConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetAuthority<'info> {
    #[account(address = config.authority @ RewardsError::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"rewards_config"], bump = config.bump)]
    pub config: Account<'info, RewardsConfig>,
}

#[derive(Accounts)]
pub struct AddPoints<'info> {
    /// Pays for the reward account on first use (the buyer in the CPI).
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the user the points belong to (seed for the reward account).
    pub user: UncheckedAccount<'info>,
    #[account(seeds = [b"rewards_config"], bump = config.bump)]
    pub config: Account<'info, RewardsConfig>,
    /// Must equal `config.authority` (the marketplace rewards PDA).
    #[account(address = config.authority @ RewardsError::Unauthorized)]
    pub authority: Signer<'info>,
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
pub struct GetTier<'info> {
    #[account(seeds = [b"rewards", reward_account.user.as_ref()], bump = reward_account.bump)]
    pub reward_account: Account<'info, RewardAccount>,
}

// ───────────────────────────── State ───────────────────────────────────

#[account]
pub struct RewardsConfig {
    pub authority: Pubkey,
    pub bump: u8,
}

impl RewardsConfig {
    pub const SIZE: usize = 32 + 1;
}

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
    #[msg("Signer is not the configured rewards authority")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
