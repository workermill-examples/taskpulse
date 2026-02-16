/**
 * Run Simulation Engine for TaskPulse
 *
 * This module simulates task execution by generating realistic run traces and logs.
 * It's used by both API routes and the seed script, so it uses relative imports
 * for Prisma types to work in both contexts.
 */

// Use relative imports for Prisma types since this file is imported by both
// Next.js app code and prisma/seed.ts (which runs outside Next.js via tsx)
import type {
  Task,
  Run,
  Trace,
  Log
} from "../generated/prisma/client";
import { RunStatus, LogLevel } from "../generated/prisma/enums";

export interface SimulatedRun {
  run: Omit<Run, 'id' | 'createdAt' | 'updatedAt'>;
  steps: Array<Omit<Trace, 'id' | 'createdAt'>>;
  logs: Array<Omit<Log, 'id'>>;
}

interface StepTemplate {
  name: string;
  avgDuration: number;
}

/**
 * Simulates a task run execution with realistic timing and logging
 *
 * @param projectId - The project ID the run belongs to
 * @param task - The task definition with step templates
 * @param input - Input data for the run
 * @param triggeredBy - Who/what triggered this run
 * @returns Complete simulation data ready for database insertion
 */
export function simulateRun(
  projectId: string,
  task: Task,
  input: unknown,
  triggeredBy: string
): SimulatedRun {
  const now = new Date();

  // Parse step templates from task config
  // NOTE: stepTemplates from registerTaskSchema are stored in task.config JSON field
  let stepTemplates: StepTemplate[] = [];
  if (task.config && typeof task.config === 'object' && task.config !== null) {
    const config = task.config as Record<string, any>;
    stepTemplates = config.stepTemplates || [];
  }

  // If no step templates, create a default single step
  if (stepTemplates.length === 0) {
    stepTemplates = [{ name: "execute", avgDuration: 5000 }];
  }

  // Determine if this run will succeed or fail (90% success rate)
  const willSucceed = Math.random() < 0.9;
  let failAtStep = -1;

  if (!willSucceed) {
    // Pick a random step to fail at (not the first step to make it more realistic)
    failAtStep = Math.max(1, Math.floor(Math.random() * stepTemplates.length));
  }

  // Generate step traces and logs
  const steps: Array<Omit<Trace, 'id' | 'createdAt'>> = [];
  const logs: Array<Omit<Log, 'id'>> = [];

  let currentTime = new Date(now.getTime() + 100); // Start slightly after run creation
  let totalDuration = 0;
  let runStatus: RunStatus = RunStatus.COMPLETED;
  let runError: string | null = null;

  // Generate traces and logs for each step
  for (let i = 0; i < stepTemplates.length; i++) {
    const stepTemplate = stepTemplates[i];
    const stepName = stepTemplate.name;
    const isFailingStep = i === failAtStep;

    // Calculate step duration with ±30% variance
    const baseDuration = stepTemplate.avgDuration;
    const variance = 0.3;
    const duration = Math.round(baseDuration * (0.7 + Math.random() * 0.6));

    const stepStartTime = new Date(currentTime);
    const stepEndTime = isFailingStep ? null : new Date(currentTime.getTime() + duration);

    // Create step trace
    const stepTrace: Omit<Trace, 'id' | 'createdAt'> = {
      runId: '', // Will be filled by caller
      parentId: null,
      name: stepName,
      type: 'step',
      startTime: stepStartTime,
      endTime: stepEndTime,
      duration: isFailingStep ? null : duration,
      status: isFailingStep ? 'error' : (i < failAtStep || failAtStep === -1 ? 'success' : 'pending'),
      metadata: {
        stepIndex: i,
        avgDuration: baseDuration,
        actualDuration: isFailingStep ? null : duration
      }
    };

    steps.push(stepTrace);

    // Generate logs for this step
    const stepStartLog: Omit<Log, 'id'> = {
      runId: '', // Will be filled by caller
      level: LogLevel.INFO,
      message: `Starting ${stepName}...`,
      metadata: { stepIndex: i, stepName },
      timestamp: stepStartTime
    };
    logs.push(stepStartLog);

    if (isFailingStep) {
      // Generate failure logs
      const errorTime = new Date(currentTime.getTime() + Math.floor(duration * 0.3));
      const errorMessages = [
        "Connection timeout occurred",
        "Validation error: invalid input format",
        "External service unavailable",
        "Resource temporarily locked",
        "Rate limit exceeded"
      ];
      const errorMessage = errorMessages[Math.floor(Math.random() * errorMessages.length)];

      const errorLog: Omit<Log, 'id'> = {
        runId: '', // Will be filled by caller
        level: LogLevel.ERROR,
        message: `Step '${stepName}' failed: ${errorMessage}`,
        metadata: {
          stepIndex: i,
          stepName,
          error: errorMessage,
          retryable: Math.random() < 0.7 // 70% of failures are retryable
        },
        timestamp: errorTime
      };
      logs.push(errorLog);

      runStatus = RunStatus.FAILED;
      runError = `Step '${stepName}' failed: ${errorMessage}`;
      totalDuration = errorTime.getTime() - now.getTime() - 100;
      break;
    } else {
      // Generate progress logs for successful steps
      const progressPoints = Math.floor(Math.random() * 3) + 2; // 2-4 progress logs

      for (let p = 1; p < progressPoints; p++) {
        const progressTime = new Date(
          stepStartTime.getTime() + (duration / progressPoints) * p
        );

        const progressMessages = [
          `Processing ${stepName}: ${Math.floor((p / progressPoints) * 100)}% complete`,
          `${stepName}: validating input data`,
          `${stepName}: connecting to external service`,
          `${stepName}: processing batch ${p} of ${progressPoints}`,
          `${stepName}: updating records`,
        ];

        const progressLog: Omit<Log, 'id'> = {
          runId: '', // Will be filled by caller
          level: LogLevel.DEBUG,
          message: progressMessages[Math.floor(Math.random() * progressMessages.length)],
          metadata: {
            stepIndex: i,
            stepName,
            progress: Math.floor((p / progressPoints) * 100)
          },
          timestamp: progressTime
        };
        logs.push(progressLog);
      }

      // Step completion log
      const completionLog: Omit<Log, 'id'> = {
        runId: '', // Will be filled by caller
        level: LogLevel.INFO,
        message: `Completed ${stepName} in ${duration}ms`,
        metadata: {
          stepIndex: i,
          stepName,
          duration,
          success: true
        },
        timestamp: stepEndTime!
      };
      logs.push(completionLog);

      totalDuration += duration;
      currentTime = stepEndTime!;
    }
  }

  // Calculate run times
  const runStartTime = new Date(now.getTime() + 50); // Slight delay after creation
  const runEndTime = runStatus === RunStatus.FAILED ?
    new Date(now.getTime() + 50 + totalDuration) :
    new Date(runStartTime.getTime() + totalDuration);

  // Create the run object
  const run: Omit<Run, 'id' | 'createdAt' | 'updatedAt'> = {
    projectId,
    taskId: task.id,
    createdBy: '', // Will be filled by caller
    status: runStatus,
    input: input ? JSON.parse(JSON.stringify(input)) : null,
    output: runStatus === RunStatus.COMPLETED ? generateOutput(task, input) : null,
    error: runError,
    duration: totalDuration,
    startedAt: runStartTime,
    completedAt: runStatus === RunStatus.COMPLETED || runStatus === RunStatus.FAILED ? runEndTime : null,
  };

  return {
    run,
    steps,
    logs
  };
}

/**
 * Generates realistic output data for completed runs
 */
function generateOutput(task: Task, input: unknown): Record<string, any> {
  const baseOutput = {
    success: true,
    executedAt: new Date().toISOString(),
    taskName: task.name,
    processedRecords: Math.floor(Math.random() * 1000) + 1,
  };

  // Add task-specific output based on task name
  if (task.name.includes('email')) {
    return {
      ...baseOutput,
      emailsSent: Math.floor(Math.random() * 50) + 1,
      bounceRate: Math.random() * 0.05, // 0-5% bounce rate
    };
  }

  if (task.name.includes('payment')) {
    return {
      ...baseOutput,
      transactionsProcessed: Math.floor(Math.random() * 200) + 1,
      totalAmount: Math.floor(Math.random() * 100000) + 1000,
      currency: 'USD',
    };
  }

  if (task.name.includes('report')) {
    return {
      ...baseOutput,
      reportGenerated: true,
      fileSize: Math.floor(Math.random() * 10000) + 1000,
      format: 'PDF',
    };
  }

  return baseOutput;
}

/**
 * Creates a run simulation for a QUEUED status (not yet started)
 */
export function simulateQueuedRun(
  projectId: string,
  task: Task,
  input: unknown,
  triggeredBy: string
): SimulatedRun {
  const now = new Date();

  const run: Omit<Run, 'id' | 'createdAt' | 'updatedAt'> = {
    projectId,
    taskId: task.id,
    createdBy: '', // Will be filled by caller
    status: RunStatus.QUEUED,
    input: input ? JSON.parse(JSON.stringify(input)) : null,
    output: null,
    error: null,
    duration: null,
    startedAt: null,
    completedAt: null,
  };

  // Generate initial queued log
  const logs: Array<Omit<Log, 'id'>> = [{
    runId: '', // Will be filled by caller
    level: LogLevel.INFO,
    message: `Run queued for task: ${task.name}`,
    metadata: {
      taskName: task.name,
      triggeredBy,
      status: 'QUEUED'
    },
    timestamp: now
  }];

  return {
    run,
    steps: [], // No steps for queued runs
    logs
  };
}

/**
 * Creates a run simulation for an EXECUTING status (in progress)
 */
export function simulateExecutingRun(
  projectId: string,
  task: Task,
  input: unknown,
  triggeredBy: string
): SimulatedRun {
  const now = new Date();

  // Parse step templates from task config
  let stepTemplates: StepTemplate[] = [];
  if (task.config && typeof task.config === 'object' && task.config !== null) {
    const config = task.config as Record<string, any>;
    stepTemplates = config.stepTemplates || [];
  }

  if (stepTemplates.length === 0) {
    stepTemplates = [{ name: "execute", avgDuration: 5000 }];
  }

  const runStartTime = new Date(now.getTime() - Math.floor(Math.random() * 30000)); // Started up to 30s ago
  const steps: Array<Omit<Trace, 'id' | 'createdAt'>> = [];
  const logs: Array<Omit<Log, 'id'>> = [];

  // Determine how many steps are completed vs executing vs queued
  const currentStepIndex = Math.floor(Math.random() * stepTemplates.length);
  let currentTime = new Date(runStartTime);

  // Add initial log
  logs.push({
    runId: '', // Will be filled by caller
    level: LogLevel.INFO,
    message: `Started execution of task: ${task.name}`,
    metadata: { taskName: task.name, triggeredBy },
    timestamp: runStartTime
  });

  // Generate completed steps
  for (let i = 0; i < currentStepIndex; i++) {
    const stepTemplate = stepTemplates[i];
    const duration = Math.round(stepTemplate.avgDuration * (0.7 + Math.random() * 0.6));
    const stepStartTime = new Date(currentTime);
    const stepEndTime = new Date(currentTime.getTime() + duration);

    steps.push({
      runId: '', // Will be filled by caller
      parentId: null,
      name: stepTemplate.name,
      type: 'step',
      startTime: stepStartTime,
      endTime: stepEndTime,
      duration,
      status: 'success',
      metadata: { stepIndex: i, avgDuration: stepTemplate.avgDuration }
    });

    logs.push({
      runId: '', // Will be filled by caller
      level: LogLevel.INFO,
      message: `Completed ${stepTemplate.name} in ${duration}ms`,
      metadata: { stepIndex: i, stepName: stepTemplate.name, duration },
      timestamp: stepEndTime
    });

    currentTime = stepEndTime;
  }

  // Add currently executing step
  if (currentStepIndex < stepTemplates.length) {
    const currentStep = stepTemplates[currentStepIndex];
    const stepStartTime = new Date(currentTime);

    steps.push({
      runId: '', // Will be filled by caller
      parentId: null,
      name: currentStep.name,
      type: 'step',
      startTime: stepStartTime,
      endTime: null,
      duration: null,
      status: 'executing',
      metadata: { stepIndex: currentStepIndex, avgDuration: currentStep.avgDuration }
    });

    logs.push({
      runId: '', // Will be filled by caller
      level: LogLevel.INFO,
      message: `Starting ${currentStep.name}...`,
      metadata: { stepIndex: currentStepIndex, stepName: currentStep.name },
      timestamp: stepStartTime
    });

    // Add some progress logs for the current step
    const progressTime = new Date(stepStartTime.getTime() + Math.floor(Math.random() * 10000) + 1000);
    logs.push({
      runId: '', // Will be filled by caller
      level: LogLevel.DEBUG,
      message: `${currentStep.name}: processing in progress...`,
      metadata: { stepIndex: currentStepIndex, stepName: currentStep.name },
      timestamp: progressTime
    });
  }

  // Add queued steps (remaining steps)
  for (let i = currentStepIndex + 1; i < stepTemplates.length; i++) {
    const stepTemplate = stepTemplates[i];

    steps.push({
      runId: '', // Will be filled by caller
      parentId: null,
      name: stepTemplate.name,
      type: 'step',
      startTime: new Date(0), // Placeholder, not started yet
      endTime: null,
      duration: null,
      status: 'pending',
      metadata: { stepIndex: i, avgDuration: stepTemplate.avgDuration }
    });
  }

  const run: Omit<Run, 'id' | 'createdAt' | 'updatedAt'> = {
    projectId,
    taskId: task.id,
    createdBy: '', // Will be filled by caller
    status: RunStatus.EXECUTING,
    input: input ? JSON.parse(JSON.stringify(input)) : null,
    output: null,
    error: null,
    duration: null,
    startedAt: runStartTime,
    completedAt: null,
  };

  return {
    run,
    steps,
    logs
  };
}