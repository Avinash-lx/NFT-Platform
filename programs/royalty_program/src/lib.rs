//! PRISM royalty program.
//!
//! Pays the creator's royalty share out of a sale. The marketplace passes the
//! sale price; this program computes `price * royalty_bps / 10000` and transfers
//! it from the buyer (payer) to the creator.

use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("ROY1111111111111111111111111111111111111111");

const BPS_DENOMINATOR: u64 = 10_000;

#[program]
pub mod royalty_program {
    use super::*;

    /// Distribute a creator royalty for a sale.
    pub fn pay_royalty(ctx: Context<PayRoyalty>, price: u64, royalty_bps: u16) -> Result<()> {
        require!(royalty_bps <= 10_000, RoyaltyError::InvalidRoyalty);

        let amount = price
            .checked_mul(royalty_bps as u64)
            .and_then(|v| v.checked_div(BPS_DENOMINATOR))
            .ok_or(RoyaltyError::MathOverflow)?;

        if amount > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.payer.to_account_info(),
                        to: ctx.accounts.creator.to_account_info(),
                    },
                ),
                amount,
            )?;
        }

        emit!(RoyaltyPaid {
            creator: ctx.accounts.creator.key(),
            amount,
        });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct PayRoyalty<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: royalty recipient (NFT creator).
    #[account(mut)]
    pub creator: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct RoyaltyPaid {
    pub creator: Pubkey,
    pub amount: u64,
}

#[error_code]
pub enum RoyaltyError {
    #[msg("Royalty basis points must be <= 10000")]
    InvalidRoyalty,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
