import Joi from 'joi';

// Only ipv4 supported right now. TODO: Support v6
const ipv4RulePattern =
  /^((dst|src)Network=(\d{1,3}\.){3}\d{1,3}\/\d{1,2},){1,2}(srcPort=\d+,)?(dstPort=\d+,)?protocol=ip$/;

// TODO: Improve validation!
export default {
  setRules: Joi.object({
    outgoing: Joi.object().pattern(ipv4RulePattern, Joi.object({
      rate: Joi.string(),
      delay: Joi.string(),
      jitter: Joi.string(),
      loss: Joi.string(),
      corrupt: Joi.string()
    })),
    incoming: Joi.object().pattern(ipv4RulePattern, Joi.object({
      rate: Joi.string(),
      delay: Joi.string(),
      jitter: Joi.string(),
      loss: Joi.string(),
      corrupt: Joi.string()
    })),
  }).unknown(false).required()
};
