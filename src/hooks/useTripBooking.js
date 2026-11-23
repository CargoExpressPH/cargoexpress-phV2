import { useNavigate } from 'react-router-dom';

/**
 * Shared "select a trip to book" action.
 * In v2, authentication is no longer required for booking:
 * Selecting a trip sends the user straight to the public booking form
 * with the route and trip preselected.
 */
export const useTripBooking = () => {
  const navigate = useNavigate();

  return (trip) => {
    if (!trip) return;
    navigate('/#booking-section', {
      state: { preselectedRoute: `${trip.origin} → ${trip.destination}`, preselectedTripId: trip.id },
    });
  };
};

export default useTripBooking;
