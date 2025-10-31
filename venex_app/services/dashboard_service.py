# venex_app/services/dashboard_service.py
from django.core.cache import cache
from decimal import Decimal
import logging
from ..models import Portfolio, Cryptocurrency

logger = logging.getLogger(__name__)

class DashboardService:
    
    @staticmethod
    def get_user_portfolio_value(user):
        """
        Calculate user's portfolio value with real-time crypto prices
        """
        try:
            # Ensure crypto data is fresh
            from .crypto_api_service import crypto_service
            crypto_service.update_cryptocurrency_data()
            
            # Get all portfolio entries for the user
            portfolios = Portfolio.objects.filter(user=user)
            
            total_balance = Decimal('0.0')
            total_invested = Decimal('0.0')
            total_profit_loss = Decimal('0.0')
            portfolio_details = []
            
            for portfolio in portfolios:
                # Get current price from Cryptocurrency model
                try:
                    crypto = Cryptocurrency.objects.get(symbol=portfolio.cryptocurrency)
                    current_price = crypto.current_price
                except Cryptocurrency.DoesNotExist:
                    # Fallback to average buy price if crypto not found
                    current_price = portfolio.average_buy_price
                
                # Calculate current value
                current_value = portfolio.total_quantity * current_price
                
                # Update portfolio values
                portfolio.current_value = current_value
                portfolio.profit_loss = current_value - portfolio.total_invested
                
                if portfolio.total_invested > 0:
                    calculated_percentage = (
                        (portfolio.profit_loss / portfolio.total_invested) * 100
                    )
                    # Cap percentage at reasonable limits to prevent database overflow
                    # Max: 99,999,999.9999 (12 digits, 4 decimals)
                    if calculated_percentage > Decimal('99999999.9999'):
                        portfolio.profit_loss_percentage = Decimal('99999999.9999')
                    elif calculated_percentage < Decimal('-99999999.9999'):
                        portfolio.profit_loss_percentage = Decimal('-99999999.9999')
                    else:
                        portfolio.profit_loss_percentage = calculated_percentage
                else:
                    portfolio.profit_loss_percentage = Decimal('0.0')
                
                # Save updated portfolio
                portfolio.save()
                
                # Aggregate totals
                total_balance += current_value
                total_invested += portfolio.total_invested
                total_profit_loss += portfolio.profit_loss
                
                # Add to portfolio details
                portfolio_details.append({
                    'symbol': portfolio.cryptocurrency,
                    'name': portfolio.get_cryptocurrency_display(),  # type: ignore
                    'quantity': float(portfolio.total_quantity),
                    'current_price': float(current_price),
                    'current_value': float(current_value),
                    'total_invested': float(portfolio.total_invested),
                    'profit_loss': float(portfolio.profit_loss),
                    'profit_loss_percentage': float(portfolio.profit_loss_percentage),
                    'average_buy_price': float(portfolio.average_buy_price),
                    'price_change_24h': float(crypto.price_change_24h) if hasattr(crypto, 'price_change_24h') else 0, # type: ignore
                    'price_change_percentage_24h': float(crypto.price_change_percentage_24h) if hasattr(crypto, 'price_change_percentage_24h') else 0 # type: ignore
                })
            
            # Calculate overall profit/loss percentage
            if total_invested > 0:
                total_profit_loss_pct = (total_profit_loss / total_invested) * 100
            else:
                total_profit_loss_pct = Decimal('0.0')
            
            return {
                'total_balance': float(total_balance),
                'total_invested': float(total_invested),
                'total_profit_loss': float(total_profit_loss),
                'total_profit_loss_pct': float(total_profit_loss_pct),
                'portfolio_details': portfolio_details
            }
            
        except Exception as e:
            logger.error(f"Error calculating portfolio value: {e}")
            # Return default values in case of error
            return {
                'total_balance': 0.0,
                'total_invested': 0.0,
                'total_profit_loss': 0.0,
                'total_profit_loss_pct': 0.0,
                'portfolio_details': []
            }