const HelpRequest = require('../models/HelpRequest');

/**
 * Calculates live rating statistics for a volunteer from all completed help requests & reviews.
 * Returns exact metrics:
 * - reviewsCount (total reviews submitted)
 * - tasksCompleted (total completed requests)
 * - costUtilization (average score 1-5, e.g. 4.6)
 * - speedTimeliness (average score 1-5, e.g. 4.8)
 * - communication (average score 1-5, e.g. 4.7)
 * - overallRating (average of the 3 metrics, e.g. 4.7)
 * - recommendationRate (percentage of Yes choices, e.g. 94%)
 */
async function getVolunteerRatingStats(volunteerId) {
  if (!volunteerId) {
    return {
      reviewsCount: 0,
      tasksCompleted: 0,
      costUtilization: 0,
      speedTimeliness: 0,
      communication: 0,
      overallRating: 0,
      recommendationRate: 0
    };
  }

  const completedRequests = await HelpRequest.find({
    volunteer: volunteerId,
    status: 'completed'
  });

  const tasksCompleted = completedRequests.length;
  const feedbackList = completedRequests
    .filter(r => r.feedback && (r.feedback.submittedAt || r.feedback.costUtilization))
    .map(r => r.feedback);

  const reviewsCount = feedbackList.length;

  if (reviewsCount === 0) {
    return {
      reviewsCount: 0,
      tasksCompleted,
      costUtilization: 0,
      speedTimeliness: 0,
      communication: 0,
      overallRating: 0,
      recommendationRate: 0
    };
  }

  let totalCost = 0;
  let totalSpeed = 0;
  let totalComm = 0;
  let recommendYesCount = 0;

  feedbackList.forEach(f => {
    totalCost += Number(f.costUtilization || 0);
    totalSpeed += Number(f.speedTimeliness || 0);
    totalComm += Number(f.communication || 0);
    if (f.chooseAgain === 'Yes') {
      recommendYesCount += 1;
    }
  });

  const costUtilization = Number((totalCost / reviewsCount).toFixed(1));
  const speedTimeliness = Number((totalSpeed / reviewsCount).toFixed(1));
  const communication = Number((totalComm / reviewsCount).toFixed(1));

  // Overall rating is average of the 3 metrics rounded to 1 decimal place
  const overallRating = Number(((costUtilization + speedTimeliness + communication) / 3).toFixed(1));
  const recommendationRate = Math.round((recommendYesCount / reviewsCount) * 100);

  return {
    reviewsCount,
    tasksCompleted,
    costUtilization,
    speedTimeliness,
    communication,
    overallRating,
    recommendationRate
  };
}

module.exports = { getVolunteerRatingStats };
