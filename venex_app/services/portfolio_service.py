# venex_app/services/portfolio_service.py
import logging
from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from ..models import Portfolio, PortfolioHolding, PortfolioHistory, Cryptocurrency, Transaction

logger = logging.getLogger(__name__)

class PortfolioService:
    @staticmethod
    def get_user_portfolio(user):
        """Get or create portfolio for user"""
        portfolio, created = Portfolio.objects.get_or_create(user=user)
        if created:
            logger.info(f"Created new portfolio for user: {user.username}")
        return portfolio

    @staticmethod
    def calculate_portfolio_value(portfolio):
        """Calculate total portfolio value and update holdings"""
        holdings = portfolio.holdings.all()
        total_value = Decimal('0.0')
        
        for holding in holdings:
            # Update current value based on latest price
            current_price = holding.cryptocurrency.current_price
            holding.current_value = holding.amount * current_price
            holding.total_cost = holding.amount * holding.average_buy_price
            holding.unrealized_pl = holding.current_value - holding.total_cost
            
            if holding.total_cost > 0:
                holding.unrealized_pl_percentage = (
                    (holding.unrealized_pl / holding.total_cost) * Decimal('100.0')
                )
            else:
                holding.unrealized_pl_percentage = Decimal('0.0')
            
            holding.save()
            total_value += holding.current_value
        
        # Update portfolio totals
        portfolio.total_value = total_value
        
        if portfolio.initial_investment > 0:
            portfolio.unrealized_pl = total_value - portfolio.initial_investment
        else:
            portfolio.unrealized_pl = Decimal('0.0')
        
        portfolio.save()
        
        # Update allocation percentages
        PortfolioService.update_allocations(portfolio)
        
        return total_value

    @staticmethod
    def update_allocations(portfolio):
        """Update allocation percentages for all holdings"""
        holdings = portfolio.holdings.all()
        total_value = portfolio.total_value
        
        if total_value > 0:
            for holding in holdings:
                holding.allocation_percentage = (
                    (holding.current_value / total_value) * Decimal('100.0')
                )
                holding.save()

    @staticmethod
    def add_transaction(user, crypto_symbol, transaction_type, amount, price, total_amount, fee=0.0):
        """Add a transaction and update portfolio"""
        with transaction.atomic():
            cryptocurrency = Cryptocurrency.objects.get(symbol=crypto_symbol.upper())
            portfolio = PortfolioService.get_user_portfolio(user)
            
            # Create transaction
            transaction_obj = Transaction.objects.create(
                user=user,
                cryptocurrency=cryptocurrency,
                transaction_type=transaction_type,
                amount=amount,
                price=price,
                total_amount=total_amount,
                fee=fee
            )
            
            # Update portfolio holding
            holding, created = PortfolioHolding.objects.get_or_create(
                portfolio=portfolio,
                cryptocurrency=cryptocurrency,
                defaults={
                    'amount': Decimal('0.0'),
                    'average_buy_price': Decimal('0.0'),
                    'total_cost': Decimal('0.0')
                }
            )
            
            if transaction_type == 'BUY':
                # Calculate new average buy price
                total_cost = holding.total_cost + total_amount
                total_amount_coins = holding.amount + amount
                
                if total_amount_coins > 0:
                    holding.average_buy_price = total_cost / total_amount_coins
                
                holding.amount += amount
                holding.total_cost = total_cost
                
            elif transaction_type == 'SELL':
                if holding.amount < amount:
                    raise ValueError("Insufficient balance for sale")
                
                holding.amount -= amount
                # Only reduce total cost proportionally
                cost_reduction = (amount / (holding.amount + amount)) * holding.total_cost
                holding.total_cost -= cost_reduction
                
                # Update realized P/L
                portfolio.realized_pl += (total_amount - cost_reduction)
                portfolio.save()
            
            holding.save()
            
            # Recalculate portfolio value
            PortfolioService.calculate_portfolio_value(portfolio)
            
            # Add to portfolio history
            PortfolioHistory.objects.create(
                portfolio=portfolio,
                total_value=portfolio.total_value
            )
            
            return transaction_obj

    @staticmethod
    def get_portfolio_analytics(portfolio, timeframe='1M'):
        """Get portfolio analytics for charts and insights"""
        # Calculate timeframe
        timeframes = {
            '1D': timezone.now() - timezone.timedelta(days=1),
            '1W': timezone.now() - timezone.timedelta(weeks=1),
            '1M': timezone.now() - timezone.timedelta(days=30),
            '3M': timezone.now() - timezone.timedelta(days=90),
            '1Y': timezone.now() - timezone.timedelta(days=365)
        }
        
        start_date = timeframes.get(timeframe, timezone.now() - timezone.timedelta(days=30))
        
        # Get historical data
        history = PortfolioHistory.objects.filter(
            portfolio=portfolio,
            timestamp__gte=start_date
        ).order_by('timestamp')
        
        historical_data = {
            'timestamps': [h.timestamp.isoformat() for h in history],
            'values': [float(h.total_value) for h in history]
        }
        
        # Calculate risk metrics
        risk_metrics = PortfolioService.calculate_risk_metrics(portfolio)
        
        # Generate AI insights
        insights = PortfolioService.generate_ai_insights(portfolio)
        
        return {
            'historical_data': historical_data,
            'risk_metrics': risk_metrics,
            'insights': insights,
            'timeframe': timeframe
        }

    @staticmethod
    def calculate_risk_metrics(portfolio):
        """Calculate portfolio risk metrics"""
        holdings = portfolio.holdings.all()
        
        if not holdings:
            return {
                'risk_score': 0,
                'volatility': 0,
                'diversification_score': 100,
                'max_drawdown': 0
            }
        
        # Calculate volatility (simplified)
        total_value = portfolio.total_value
        volatility = Decimal('0.0')
        
        for holding in holdings:
            # Use cryptocurrency's 24h change as volatility proxy
            crypto_volatility = abs(holding.cryptocurrency.price_change_percentage_24h) / Decimal('100.0')
            weight = holding.current_value / total_value
            volatility += crypto_volatility * weight
        
        # Calculate diversification score (0-100)
        allocations = [h.allocation_percentage for h in holdings]
        if allocations:
            # Herfindahl index for concentration
            herfindahl = sum((alloc / 100) ** 2 for alloc in allocations)
            diversification_score = max(0, 100 - (herfindahl * 100))
        else:
            diversification_score = 100
        
        # Calculate risk score (0-100)
        risk_score = min(100, float(volatility * 100) + (100 - diversification_score) / 2)
        
        return {
            'risk_score': round(risk_score, 2),
            'volatility': round(float(volatility), 4),
            'diversification_score': round(diversification_score, 2),
            'max_drawdown': 0,  # Would require more historical data
            'sharpe_ratio': 0   # Would require risk-free rate and more data
        }

    @staticmethod
    def generate_ai_insights(portfolio):
        """Generate AI-driven portfolio insights"""
        holdings = portfolio.holdings.all()
        insights = []
        
        if not holdings:
            insights.append("Your portfolio is empty. Consider adding some cryptocurrencies to get started!")
            return insights
        
        # Check for over-concentration
        max_allocation = max([h.allocation_percentage for h in holdings])
        if max_allocation > 70:
            top_holding = max(holdings, key=lambda h: h.allocation_percentage)
            insights.append(
                f"Your portfolio is {max_allocation:.1f}% concentrated in {top_holding.cryptocurrency.symbol}. "
                f"Consider diversifying to reduce risk."
            )
        
        # Check for performance
        profitable_holdings = [h for h in holdings if h.unrealized_pl > 0]
        if len(profitable_holdings) >= len(holdings) * 0.7:
            insights.append("Great job! Most of your holdings are in profit. Consider taking some profits on top performers.")
        else:
            insights.append("Some of your holdings are underperforming. Review your investment strategy.")
        
        # Check diversification
        if len(holdings) < 3:
            insights.append("Consider adding more assets to your portfolio for better diversification.")
        
        # Market condition insights
        total_pl_percentage = (portfolio.unrealized_pl / portfolio.initial_investment * 100) if portfolio.initial_investment > 0 else 0
        if total_pl_percentage > 20:
            insights.append("Your portfolio is performing strongly! You're outperforming the average market returns.")
        elif total_pl_percentage < -10:
            insights.append("Market conditions are challenging. Consider dollar-cost averaging to lower your average buy prices.")
        
        return insights

# Global instance
portfolio_service = PortfolioService()