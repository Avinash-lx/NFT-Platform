//! PRISM cashback program.
//!
//! Eligible users (Diamond tier or active promotion, NFT held >= 7 days, not
//! already claimed) receive 5% of an NFT's purchase price from a treasury PDA.
//!
//! Eligibility (tier / holding period / promotion) is verified off-chain by the
//! backend, which holds the authority key. On-chain we enforce the invariants we
//! can: single claim per (user, mint), and treasury solvency.

use anchor_lang::prelude::*;

declare_id!("CSH1111111111111111111111111111111111111111");

/// Cashback percentage (5%).
const CASHBACK_PERCENT: u64 = 5;

#[program]
pub mod cashback_program {
    use super::*;

    /// Initialize the cashback treasury vault. `authority` is the wallet allowed
    /// to disburse cashback (the PRISM backend's treasury wallet). It is funded
    /// by transferring SOL to the returned vault PDA.
    pub fn initialize_treasury(ctx: Context<InitializeTreasury>, authority: Pubkey) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        treasury.authority = authority;
        treasury.bump = ctx.bumps.treasury;
        treasury.total_paid = 0;
        Ok(())
    }

    /// Request and pay cashback for a purchased NFT. The backend authority must
    /// co-sign, attesting that off-chain eligibility checks passed.
    ///
    /// `purchase_price` is the original price (lamports) the cashback is computed
    /// against.
    pub fn request_cashback(
        ctx: Context<RequestCashback>,
        mint: Pubkey,
        purchase_price: u64,
    ) -> Result<()> {
        let amount = purchase_price
            .checked_mul(CASHBACK_PERCENT)
            .and_then(|v| v.checked_div(100))
            .ok_or(CashbackError::MathOverflow)?;
        require!(amount > 0, CashbackError::NothingToPay);

        // Record the claim — the PDA seeds guarantee one record per (user, mint).
        let claim = &mut ctx.accounts.claim;
        claim.user = ctx.accounts.user.key();
        claim.mint = mint;
        claim.amount = amount;
        claim.claimed_at = Clock::get()?.unix_timestamp;
        claim.bump = ctx.bumps.claim;

        // Move lamports from the treasury PDA to the user.
        let treasury_info = ctx.accounts.treasury.to_account_info();
        let user_info = ctx.accounts.user.to_account_info();
        require!(
            treasury_info.lamports() >= amount,
            CashbackError::InsufficientTreasury
        );

        **treasury_info.try_borrow_mut_lamports()? -= amount;
        **user_info.try_borrow_mut_lamports()? += amount;

        let treasury = &mut ctx.accounts.treasury;
        treasury.total_paid = treasury
            .total_paid
            .checked_add(amount)
            .ok_or(CashbackError::MathOverflow)?;

        emit!(CashbackPaid {
            user: claim.user,
            mint,
            amount,
        });
        Ok(())
    }
}

// ───────────────────────────── Accounts ────────────────────────────────

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Treasury::SIZE,
        seeds = [b"cashback_treasury"],
        bump
    )]
    pub treasury: Account<'info, Treasury>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(mint: Pubkey)]
pub struct RequestCashback<'info> {
    /// The treasury authority (held by the PRISM backend, which attests
    /// off-chain eligibility). Sole signer — the recipient need not sign.
    #[account(mut, address = treasury.authority @ CashbackError::Unauthorized)]
    pub authority: Signer<'info>,
    /// CHECK: cashback recipient; receives lamports from the treasury PDA.
    #[account(mut)]
    pub user: UncheckedAccount<'info>,
    #[account(mut, seeds = [b"cashback_treasury"], bump = treasury.bump)]
    pub treasury: Account<'info, Treasury>,
    /// One claim per (user, mint) — the seeds enforce single-claim on-chain.
    #[account(
        init,
        payer = authority,
        space = 8 + CashbackClaim::SIZE,
        seeds = [b"cashback", user.key().as_ref(), mint.as_ref()],
        bump
    )]
    pub claim: Account<'info, CashbackClaim>,
    pub system_program: Program<'info, System>,
}

// ───────────────────────────── State ───────────────────────────────────

#[account]
pub struct Treasury {
    pub authority: Pubkey,
    pub total_paid: u64,
    pub bump: u8,
}

impl Treasury {
    pub const SIZE: usize = 32 + 8 + 1;
}

#[account]
pub struct CashbackClaim {
    pub user: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub claimed_at: i64,
    pub bump: u8,
}

impl CashbackClaim {
    pub const SIZE: usize = 32 + 32 + 8 + 8 + 1;
}

// ───────────────────────────── Events ──────────────────────────────────

#[event]
pub struct CashbackPaid {
    pub user: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
}

// ───────────────────────────── Errors ──────────────────────────────────

#[error_code]
pub enum CashbackError {
    #[msg("Signer is not the treasury authority")]
    Unauthorized,
    #[msg("Computed cashback amount is zero")]
    NothingToPay,
    #[msg("Treasury has insufficient funds")]
    InsufficientTreasury,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
